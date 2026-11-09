import type { Outcome } from "../types.js";

export type AuditStage =
  | "configuration"
  | "source"
  | "policy"
  | "context"
  | "reviewer"
  | "evidence"
  | "recheck"
  | "admission"
  | "lifecycle";

export type SourceDetail =
  | "missing_source_identifiers"
  | "capture_missing"
  | "capture_expired"
  | "invalid_command"
  | "invalid_workdir"
  | "external_workdir"
  | "stateful_workdir_mismatch";

// Local reason codes only; never derive diagnostics from exception/provider text.
export function decisionStage(code: string): AuditStage {
  if (code === "invalid_configuration") return "configuration";
  if (code === "missing_full_command" || code === "gate_error") return "source";
  if (code === "input_changed" || code === "project_changed") return "recheck";
  if (["unloaded", "cancelled", "timeout"].includes(code)) return "lifecycle";
  if (["review_capacity", "stateful_busy"].includes(code)) return "admission";
  if (
    code.startsWith("evidence_") ||
    ["project_incomplete", "invalid_evidence_reference"].includes(code)
  )
    return "evidence";
  return "reviewer";
}

export function diagnostics(outcome: Outcome) {
  return {
    stage:
      outcome.stage ??
      (outcome.code === "policy_requires_review"
        ? "policy"
        : decisionStage(outcome.code)),
    detailCode: outcome.detailCode ?? outcome.code,
  };
}
