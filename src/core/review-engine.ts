import type { AuditStage } from "../observability/diagnostics.js";
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
import {
  ProjectLoop,
  projectEligible,
  projectFailure,
} from "./project-loop.js";
import { applyPolicy, eligible, inspectionFailure } from "./policy-engine.js";

export interface ReviewLifecycle {
  started?: number;
  prepare?: (signal: AbortSignal) => Promise<ReviewInput | Outcome>;
  recheck?: (signal: AbortSignal) => Promise<Outcome | undefined>;
}
interface Waiter {
  sessionID: string;
  start: () => void;
}

export class ReviewEngine {
  private readonly pending = new Set<AbortController>();
  private readonly controllers = new Set<AbortController>();
  private readonly waiting: Waiter[] = [];
  private readonly busy = new Set<string>();
  private closed = false;
  private readonly projectLoop: ProjectLoop | undefined;
  constructor(
    private readonly config: Config,
    private readonly reviewer: Reviewer,
    project?: EvidenceSource,
  ) {
    this.projectLoop = project
      ? new ProjectLoop(config, project, reviewer)
      : undefined;
  }

  private route(input: ReviewInput): "inspection" | "project" | Outcome {
    const strategy = this.config.review.strategy;
    if (strategy !== "stateless") {
      if (
        this.config.review.alwaysAsk.some((part) =>
          input.command.includes(part),
        )
      )
        return {
          ...ask("policy_requires_review", false),
          stage: "policy",
          detailCode: "always_ask_match",
        };
    }
    // Eligibility is decided once. A reviewer ask/error is never retried through
    // the project path, and mismatched scanner resources never become inspection.
    if (strategy !== "stateful" && eligible(input, this.config.mode)) {
      if (
        strategy === "hybrid" &&
        this.config.review.forbiddenEffects.some(
          (effect) =>
            effect === "workspace_read" || effect === "process_execution",
        )
      )
        return {
          ...ask("policy_requires_review", false),
          stage: "policy",
          detailCode: "inspection_forbidden_effect",
        };
      return "inspection";
    }
    if (projectEligible(input, this.config)) return "project";
    return {
      ...ask("policy_requires_review", false),
      stage: "policy",
      detailCode:
        (strategy === "stateless"
          ? inspectionFailure(input, this.config.mode)
          : projectFailure(input, this.config)) ?? "policy_requires_review",
    };
  }

  // Pick the first admissible waiter. Busy sessions cannot hold up other sessions;
  // skipping them preserves FIFO within each session.
  private drain(): void {
    if (this.closed) return;
    for (
      let index = 0;
      index < this.waiting.length && this.pending.size < 8;

    ) {
      const waiter = this.waiting[index]!;
      if (this.busy.has(waiter.sessionID)) {
        index++;
        continue;
      }
      this.waiting.splice(index, 1);
      waiter.start();
    }
  }

  async review(
    input: ReviewInput,
    context?: () => Promise<readonly string[]>,
    sessionID?: string,
    lifecycle: ReviewLifecycle = {},
  ): Promise<Outcome> {
    const entered = lifecycle.started ?? performance.now();
    if (this.closed) return ask("unloaded");
    const path = this.route(input);
    if (typeof path !== "string") return path;
    const projectReview = path === "project";
    if (projectReview && (!this.projectLoop || !sessionID))
      return ask("project_incomplete");
    const mustWait =
      projectReview && (this.pending.size >= 8 || this.busy.has(sessionID!));
    if (!projectReview && this.pending.size >= 8)
      return { ...ask("review_capacity"), reviewPath: path, queueWaitMs: 0 };
    if (mustWait && this.waiting.length >= 32)
      return { ...ask("review_queue_full"), reviewPath: path, queueWaitMs: 0 };
    if (
      mustWait &&
      this.waiting.filter((item) => item.sessionID === sessionID).length >= 8
    )
      return { ...ask("session_queue_full"), reviewPath: path, queueWaitMs: 0 };
    const controller = new AbortController();
    this.controllers.add(controller);
    let calls = 0;
    let stage: AuditStage = mustWait ? "admission" : "source";
    let queueWaitMs = 0;
    const queuedAt = performance.now();
    let waiter: Waiter | undefined;
    let resolveDecision!: (outcome: Outcome) => void;
    const decision = new Promise<Outcome>((resolve) => {
      resolveDecision = resolve;
    });
    const abort = () => {
      if (waiter) {
        const index = this.waiting.indexOf(waiter);
        if (index >= 0) this.waiting.splice(index, 1);
        queueWaitMs = performance.now() - queuedAt;
        waiter = undefined;
      }
      resolveDecision(ask(this.closed ? "unloaded" : "timeout"));
    };
    controller.signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () => controller.abort(),
      Math.max(0, this.config.timeoutMs - (performance.now() - entered)),
    );
    const current = () => {
      if (
        performance.now() - entered >= this.config.timeoutMs &&
        !controller.signal.aborted
      )
        controller.abort();
      return !controller.signal.aborted && !this.closed;
    };
    const start = () => {
      waiter = undefined;
      queueWaitMs = mustWait ? performance.now() - queuedAt : 0;
      if (
        controller.signal.aborted ||
        performance.now() - entered >= this.config.timeoutMs
      ) {
        controller.abort();
        return;
      }
      this.pending.add(controller);
      if (projectReview) this.busy.add(sessionID!);
      // Keep the slot and session lock until ALL underlying work settles, even
      // when the permission deadline has already returned ask.
      void Promise.resolve()
        .then(async (): Promise<Outcome> => {
          if (!current()) return ask("cancelled");
          stage = "source";
          const prepared = lifecycle.prepare
            ? await lifecycle.prepare(controller.signal)
            : input;
          if ("decision" in prepared) return prepared;
          if (!current()) return ask("cancelled");
          const currentPath = this.route(prepared);
          if (typeof currentPath !== "string") return currentPath;
          if (currentPath !== path) return ask("input_changed");
          stage = "context";
          const labels = context ? await context() : [];
          if (!current()) return ask("cancelled");
          let result: Outcome;
          if (projectReview && this.projectLoop && sessionID) {
            stage = "evidence";
            result = await this.projectLoop.review(
              { ...prepared, context: labels },
              sessionID,
              controller.signal,
              (next) => {
                if (next === "reviewer") calls++;
                stage = next;
              },
              current,
            );
          } else {
            stage = "reviewer";
            const prompt = buildPrompt(
              { ...prepared, context: labels },
              this.config.mode,
              this.config.systemPrompt,
            );
            calls++;
            const text = await this.reviewer.generate(
              prompt,
              controller.signal,
            );
            let review;
            try {
              review = parseDecision(text);
            } catch {
              return ask("invalid_review_response");
            }
            if (!current()) return ask("cancelled");
            result = {
              ...applyPolicy(prepared, review, this.config.mode),
              ...(review.confidence !== undefined
                ? { reviewerConfidence: review.confidence }
                : {}),
              reviewerDecision: review.decision,
              reviewerRiskLevel: review.riskLevel,
            };
          }
          if (!current()) return ask("cancelled");
          if (result.decision === "allow" && lifecycle.recheck) {
            stage = "recheck";
            const failure = await lifecycle.recheck(controller.signal);
            if (failure) result = { ...result, ...failure };
          }
          if (!current()) return ask("cancelled");
          if (performance.now() - entered >= this.config.timeoutMs) {
            controller.abort();
            return ask("timeout");
          }
          return result;
        })
        .catch(
          () =>
            ({
              ...ask("review_error"),
              stage,
              detailCode:
                stage === "context"
                  ? "context_error"
                  : stage === "source"
                    ? "source_error"
                    : stage === "evidence" || stage === "recheck"
                      ? "evidence_error"
                      : "provider_error",
            }) as Outcome,
        )
        .then(resolveDecision)
        .finally(() => {
          this.pending.delete(controller);
          if (projectReview) this.busy.delete(sessionID!);
          this.drain();
        });
    };
    if (mustWait) {
      waiter = {
        sessionID: sessionID!,
        start,
      };
      this.waiting.push(waiter);
    } else start();
    try {
      const result = await decision;
      return {
        ...result,
        reviewPath: path,
        queueWaitMs,
        reviewCalls: calls,
        ...(result.code === "timeout" || result.code === "unloaded"
          ? { stage }
          : {}),
      };
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", abort);
      this.controllers.delete(controller);
    }
  }
  close(): void {
    this.closed = true;
    this.projectLoop?.close();
    for (const controller of this.controllers) controller.abort();
    for (const controller of this.pending) controller.abort();
    this.waiting.length = 0;
  }
}
