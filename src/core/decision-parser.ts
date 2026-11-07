import { object } from "../config/schema.js";
import type { ReviewDecision } from "../types.js";

export const ALLOW_REASONS = [
  "Read-only inspection.",
  "Read-only repository inspection.",
];
export function rejectDuplicateFields(text: string, arrays = false): void {
  // A tiny flat-JSON lexer preserves duplicate keys, which JSON.parse discards.
  // Stateless values are scalars; the project protocol also admits string arrays.
  // Escaped keys are decoded before checking for duplicates.
  const source = text.trim();
  if (!source.startsWith("{") || !source.endsWith("}"))
    throw new Error("Invalid object");
  const scalarField =
    /\s*("(?:[^"\\]|\\.)*")\s*:\s*(?:"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)\s*/y;
  const string = '"(?:[^"\\\\]|\\\\.)*"';
  const arrayField = new RegExp(
    `\\s*(${string})\\s*:\\s*(?:${string}|-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?|true|false|null|\\[(?:\\s*${string}\\s*(?:,\\s*${string}\\s*)*)?\\])\\s*`,
    "y",
  );
  const field = arrays ? arrayField : scalarField;
  const seen = new Set<string>();
  let offset = 1;
  while (offset < source.length - 1) {
    field.lastIndex = offset;
    const match = field.exec(source);
    if (!match?.[1]) throw new Error("Invalid field");
    const key: unknown = JSON.parse(match[1]);
    if (typeof key !== "string" || seen.has(key))
      throw new Error("Duplicate field");
    seen.add(key);
    offset = field.lastIndex;
    if (offset === source.length - 1) break;
    if (source[offset] !== ",") throw new Error("Invalid separator");
    offset++;
    if (source.slice(offset, -1).trim() === "")
      throw new Error("Trailing comma");
  }
}
export function parseDecision(text: string): ReviewDecision {
  if (text.length > 4096) throw new Error("Invalid response");
  rejectDuplicateFields(text);
  const value: unknown = JSON.parse(text);
  if (
    !object(value) ||
    Object.keys(value).some(
      (key) => !["decision", "riskLevel", "reason", "confidence"].includes(key),
    )
  )
    throw new Error("Invalid response");
  if (value.decision !== "allow" && value.decision !== "ask")
    throw new Error("Invalid decision");
  if (
    value.riskLevel !== "low" &&
    value.riskLevel !== "medium" &&
    value.riskLevel !== "high"
  )
    throw new Error("Invalid risk");
  if (
    typeof value.reason !== "string" ||
    !value.reason.trim() ||
    value.reason.length > 300 ||
    /[\u0000-\u001f\u007f]/.test(value.reason)
  )
    throw new Error("Invalid reason");
  if (
    value.confidence !== undefined &&
    (typeof value.confidence !== "number" ||
      !Number.isFinite(value.confidence) ||
      value.confidence < 0 ||
      value.confidence > 1)
  )
    throw new Error("Invalid confidence");
  if (
    value.decision === "allow" &&
    (value.riskLevel !== "low" || !ALLOW_REASONS.includes(value.reason))
  )
    throw new Error("Conflicting or ambiguous response");
  return {
    decision: value.decision,
    riskLevel: value.riskLevel,
    reason: value.reason,
    ...(typeof value.confidence === "number"
      ? { confidence: value.confidence }
      : {}),
  };
}
