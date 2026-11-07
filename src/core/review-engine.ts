import type { Config } from "../config/schema.js";
import { buildPrompt } from "../llm/prompt.js";
import {
  ask,
  type Outcome,
  type Reviewer,
  type ReviewInput,
} from "../types.js";
import { parseDecision } from "./decision-parser.js";
import type { EvidenceSource } from "./project-review.js";
import { ProjectLoop, projectEligible } from "./project-loop.js";
import { applyPolicy, eligible } from "./policy-engine.js";

export class ReviewEngine {
  private readonly pending = new Set<AbortController>();
  private closed = false;
  private readonly projectLoop: ProjectLoop | undefined;
  private readonly busy = new Set<string>();
  constructor(
    private readonly config: Config,
    private readonly reviewer: Reviewer,
    project?: EvidenceSource,
  ) {
    this.projectLoop = project
      ? new ProjectLoop(config, project, reviewer)
      : undefined;
  }

  async review(
    input: ReviewInput,
    context?: () => Promise<readonly string[]>,
    sessionID?: string,
  ): Promise<Outcome> {
    if (this.closed) return ask("unloaded");
    if (
      this.config.review.strategy === "stateful" &&
      !projectEligible(input, this.config)
    )
      return ask("policy_requires_review", false);
    const inspection =
      this.config.review.strategy === "stateless" &&
      eligible(input, this.config.mode);
    const projectReview = !inspection && projectEligible(input, this.config);
    if (!inspection && !projectReview)
      return ask("policy_requires_review", false);
    if (projectReview && (!this.projectLoop || !sessionID))
      return ask("project_incomplete");
    if (projectReview && sessionID && this.busy.has(sessionID))
      return ask("stateful_busy");
    // Bound both active calls and calls still running after a deadline. A provider
    // that ignores cancellation must not cause unbounded background requests.
    if (this.pending.size >= 8) return ask("review_capacity");
    const controller = new AbortController();
    this.pending.add(controller);
    if (projectReview && sessionID) this.busy.add(sessionID);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    const work = Promise.resolve()
      .then(async () => {
        const labels = context ? await context() : [];
        if (controller.signal.aborted) return ask("cancelled");
        if (projectReview && this.projectLoop && sessionID)
          return this.projectLoop.review(
            { ...input, context: labels },
            sessionID,
            controller.signal,
          );
        const text = await this.reviewer.generate(
          buildPrompt(
            { ...input, context: labels },
            this.config.mode,
            this.config.systemPrompt,
          ),
          controller.signal,
        );
        let review;
        try {
          review = parseDecision(text);
        } catch {
          return ask("invalid_review_response");
        }
        if (controller.signal.aborted || this.closed) return ask("cancelled");
        return {
          ...applyPolicy(input, review, this.config.mode),
          reviewerDecision: review.decision,
          reviewerRiskLevel: review.riskLevel,
        };
      })
      .catch(() => ask("review_error"))
      .finally(() => {
        this.pending.delete(controller);
        if (projectReview && sessionID) this.busy.delete(sessionID);
      });
    const cancelled = new Promise<Outcome>((resolve) => {
      abort = () => resolve(ask(this.closed ? "unloaded" : "timeout"));
      controller.signal.addEventListener("abort", abort, { once: true });
      timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    });
    try {
      return await Promise.race([work, cancelled]);
    } finally {
      clearTimeout(timer);
      if (abort) controller.signal.removeEventListener("abort", abort);
    }
  }
  close(): void {
    this.closed = true;
    this.projectLoop?.close();
    this.busy.clear();
    for (const controller of this.pending) controller.abort();
  }
}
