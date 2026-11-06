import type { Config } from "../config/schema.js";
import type { Outcome } from "../types.js";

export interface AuditRecord {
  timestamp: string;
  action: "shell";
  decision: "allow" | "ask";
  riskLevel: Outcome["riskLevel"];
  durationMs: number;
  reason: string;
  fallback: boolean;
}
export function audit(
  config: Config["logging"],
  outcome: Outcome,
  durationMs: number,
  sink: (record: AuditRecord) => void = (record) =>
    console.error(JSON.stringify(record)),
): void {
  if (!config.enabled || (config.level === "error" && !outcome.fallback))
    return;
  // Never emit provider-controlled reasons, commands, session IDs or error text.
  const record: AuditRecord = {
    timestamp: new Date().toISOString(),
    action: "shell",
    decision: outcome.decision,
    riskLevel: outcome.riskLevel,
    durationMs: Math.max(0, Math.round(durationMs)),
    reason: outcome.code,
    fallback: outcome.fallback,
  };
  try {
    sink(record);
  } catch {
    /* Audit failure must not alter the permission result. */
  }
}
