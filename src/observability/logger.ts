import type { Config } from "../config/schema.js";
import { diagnostics, type AuditStage } from "./diagnostics.js";
import type { Mode, Outcome } from "../types.js";

export interface AuditRecord {
  schemaVersion: 2;
  strategy: Config["review"]["strategy"] | "unknown";
  mode: Mode | "unknown";
  stage: AuditStage;
  detailCode: string;
  resourceCount: number | null;
  reviewerConfidence?: number;
  sessionID?: string;
  command?: string;
  timestamp: string;
  action: "shell";
  decision: "allow" | "ask";
  riskLevel: Outcome["riskLevel"];
  durationMs: number;
  reason: string;
  fallback: boolean;
  reviewCalls: number;
  evidenceCount?: number;
  reviewerReasonCode?: string;
  reviewerDecision?: Outcome["reviewerDecision"];
  reviewerRiskLevel?: Outcome["reviewerRiskLevel"];
}
export function audit(
  config: Config["logging"],
  outcome: Outcome,
  durationMs: number,
  sink: (record: AuditRecord) => void = (record) =>
    console.error(JSON.stringify(record)),
  source?: {
    sessionID: string;
    command?: string;
    resourceCount?: number;
    strategy?: Config["review"]["strategy"];
    mode?: Mode;
  },
): void {
  if (!config.enabled || (config.level === "error" && !outcome.fallback))
    return;
  // Serialize only explicit fields; never emit provider prose or error text.
  const record: AuditRecord = {
    schemaVersion: 2,
    strategy: source?.strategy ?? "unknown",
    mode: source?.mode ?? "unknown",
    resourceCount: source?.resourceCount ?? null,
    reviewCalls: outcome.reviewCalls ?? 0,
    ...diagnostics(outcome),
    ...(outcome.reviewerConfidence !== undefined
      ? { reviewerConfidence: outcome.reviewerConfidence }
      : {}),
    ...(source ? { sessionID: source.sessionID } : {}),
    ...(config.includeCommands && source?.command !== undefined
      ? { command: source.command }
      : {}),
    timestamp: new Date().toISOString(),
    action: "shell",
    decision: outcome.decision,
    riskLevel: outcome.riskLevel,
    durationMs: Math.max(0, Math.round(durationMs)),
    reason: outcome.code,
    fallback: outcome.fallback,
    ...(outcome.evidenceCount !== undefined
      ? { evidenceCount: outcome.evidenceCount }
      : {}),
    ...(outcome.reviewerReasonCode
      ? { reviewerReasonCode: outcome.reviewerReasonCode }
      : {}),
    ...(outcome.reviewerDecision
      ? { reviewerDecision: outcome.reviewerDecision }
      : {}),
    ...(outcome.reviewerRiskLevel
      ? { reviewerRiskLevel: outcome.reviewerRiskLevel }
      : {}),
  };
  try {
    sink(record);
  } catch {
    /* Audit failure must not alter the permission result. */
  }
}
