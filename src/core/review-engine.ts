import type { Config } from "../config/schema.js";
import { buildPrompt } from "../llm/prompt.js";
import {
  ask,
  type Outcome,
  type Reviewer,
  type ReviewInput,
} from "../types.js";
import { parseDecision } from "./decision-parser.js";
import { applyPolicy, eligible } from "./policy-engine.js";

export class ReviewEngine {
  private readonly pending = new Set<AbortController>();
  private closed = false;
  constructor(
    private readonly config: Config,
    private readonly reviewer: Reviewer,
  ) {}

  async review(
    input: ReviewInput,
    context?: () => Promise<readonly string[]>,
  ): Promise<Outcome> {
    if (this.closed) return ask("unloaded");
    if (!eligible(input, this.config.mode))
      return ask("policy_requires_review", false);
    // Bound both active calls and calls still running after a deadline. A provider
    // that ignores cancellation must not cause unbounded background requests.
    if (this.pending.size >= 8) return ask("review_capacity");
    const controller = new AbortController();
    this.pending.add(controller);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort: (() => void) | undefined;
    const work = Promise.resolve()
      .then(async () => {
        const labels = context ? await context() : [];
        if (controller.signal.aborted) return ask("cancelled");
        const text = await this.reviewer.generate(
          buildPrompt({ ...input, context: labels }, this.config.mode),
          controller.signal,
        );
        return applyPolicy(input, parseDecision(text), this.config.mode);
      })
      .catch(() => ask("review_error"))
      .finally(() => this.pending.delete(controller));
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
    for (const controller of this.pending) controller.abort();
  }
}
