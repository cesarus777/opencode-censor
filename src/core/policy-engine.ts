import { candidate } from "../security/rules.js";
import {
  ask,
  type Mode,
  type Outcome,
  type ReviewDecision,
  type ReviewInput,
} from "../types.js";

export function eligible(input: ReviewInput, mode: Mode): boolean {
  // Resources are scanner fragments, never proof of complete source. Require an
  // independently captured tool command and a single identical scanner resource.
  return (
    input.resources.length === 1 &&
    input.resources[0] === input.command &&
    candidate(input.command, mode)
  );
}
export function applyPolicy(
  input: ReviewInput,
  review: ReviewDecision,
  mode: Mode,
): Outcome {
  const floor = { strict: 0.98, balanced: 0.9, permissive: 0.8 }[mode];
  if (!eligible(input, mode)) return ask("policy_requires_review", false);
  if (
    review.decision !== "allow" ||
    review.riskLevel !== "low" ||
    (review.confidence !== undefined && review.confidence < floor)
  )
    return {
      ...ask("review_requires_approval", false),
      riskLevel: review.riskLevel,
    };
  return { ...review, code: "review_allowed", fallback: false };
}
