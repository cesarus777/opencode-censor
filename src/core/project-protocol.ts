import { object } from "../config/schema.js";
import { rejectDuplicateFields } from "./decision-parser.js";

export const EFFECTS = [
  "workspace_read",
  "workspace_write",
  "process_execution",
  "network",
  "privilege",
  "destructive",
  "outside_project",
  "unknown",
] as const;
export type Effect = (typeof EFFECTS)[number];
export const REASONS = [
  "understood_operation",
  "incomplete_evidence",
  "uncertain_effects",
  "suspicious_instruction",
  "restricted_effect",
] as const;
export type EvidenceRequest =
  | { action: "read"; path: string }
  | { action: "list"; path: string }
  | { action: "search"; path: string; query: string };
export interface ProjectDecision {
  action: "decide";
  decision: "allow" | "ask";
  riskLevel: "low" | "medium" | "high";
  reasonCode: (typeof REASONS)[number];
  confidence: number;
  uncertain: boolean;
  evidence: string[];
  effects: Effect[];
}
const invalid = (): never => {
  throw new Error("Invalid project protocol");
};
export function parseProjectResponse(
  text: string,
): EvidenceRequest | ProjectDecision {
  if (text.length > 4096) return invalid();
  rejectDuplicateFields(text, true);
  const value: unknown = JSON.parse(text);
  if (!object(value)) return invalid();
  const exact = (fields: string[]) =>
    Object.keys(value).length === fields.length &&
    Object.keys(value).every((key) => fields.includes(key));
  if (
    value.action === "read" ||
    value.action === "list" ||
    value.action === "search"
  ) {
    if (
      !exact(
        value.action === "search"
          ? ["action", "path", "query"]
          : ["action", "path"],
      ) ||
      typeof value.path !== "string" ||
      !value.path ||
      value.path.length > 300 ||
      /[\u0000-\u001f\u007f]/.test(value.path)
    )
      return invalid();
    if (value.action === "search") {
      if (
        typeof value.query !== "string" ||
        !value.query ||
        value.query.length > 128 ||
        /[\u0000-\u001f\u007f]/.test(value.query)
      )
        return invalid();
      return { action: "search", path: value.path, query: value.query };
    }
    return { action: value.action, path: value.path };
  }
  if (
    !exact([
      "action",
      "decision",
      "riskLevel",
      "reasonCode",
      "confidence",
      "uncertain",
      "evidence",
      "effects",
    ]) ||
    value.action !== "decide" ||
    (value.decision !== "allow" && value.decision !== "ask") ||
    typeof value.riskLevel !== "string" ||
    !["low", "medium", "high"].includes(value.riskLevel) ||
    !REASONS.includes(value.reasonCode as (typeof REASONS)[number]) ||
    typeof value.confidence !== "number" ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    typeof value.uncertain !== "boolean"
  )
    return invalid();
  if (
    !Array.isArray(value.evidence) ||
    value.evidence.length > 32 ||
    value.evidence.some(
      (id) => typeof id !== "string" || !/^e[1-9][0-9]?$/.test(id),
    ) ||
    new Set(value.evidence).size !== value.evidence.length ||
    !Array.isArray(value.effects) ||
    !value.effects.length ||
    value.effects.length > EFFECTS.length ||
    value.effects.some((effect) => !EFFECTS.includes(effect)) ||
    new Set(value.effects).size !== value.effects.length
  )
    return invalid();
  return value as unknown as ProjectDecision;
}
