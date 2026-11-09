import { candidate } from "../security/rules.js";
import {
  ask,
  type Mode,
  type Outcome,
  type ReviewDecision,
  type ReviewInput,
} from "../types.js";

export function inspectionFailure(
  input: ReviewInput,
  mode: Mode,
): string | undefined {
  // Preserve the exact eligibility checks and their order.
  if (input.resources.length === 0) return "resources_missing";
  if (input.resources.length !== 1) return "multiple_resources";
  if (input.resources[0] !== input.command) return "resource_command_mismatch";
  if (!candidate(input.command, mode)) return "command_outside_grammar";
  return undefined;
}
export function eligible(input: ReviewInput, mode: Mode): boolean {
  return inspectionFailure(input, mode) === undefined;
}
export function applyPolicy(
  input: ReviewInput,
  review: ReviewDecision,
  mode: Mode,
): Outcome {
  const floor = { strict: 0.98, balanced: 0.9, permissive: 0.8 }[mode];
  const failure = inspectionFailure(input, mode);
  if (failure)
    return {
      ...ask("policy_requires_review", false),
      stage: "policy",
      detailCode: failure,
    };
  if (
    review.decision !== "allow" ||
    review.riskLevel !== "low" ||
    (review.confidence !== undefined && review.confidence < floor)
  )
    return {
      ...ask("review_requires_approval", false),
      riskLevel: review.riskLevel,
      stage: "reviewer",
      detailCode:
        review.decision !== "allow"
          ? "reviewer_requested_approval"
          : review.riskLevel !== "low"
            ? "reviewer_risk_above_low"
            : "reviewer_confidence_below_floor",
    };
  return { ...review, code: "review_allowed", fallback: false };
}
