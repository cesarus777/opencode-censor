export type Mode = "strict" | "balanced" | "permissive";
export type ReviewDecision = {
  decision: "allow" | "ask";
  riskLevel: "low" | "medium" | "high";
  reason: string;
  confidence?: number;
};
export type Outcome = ReviewDecision & { code: string; fallback: boolean };
export interface PermissionEvent {
  readonly sessionID: string;
  readonly action: string;
  readonly resources: readonly string[];
  readonly source?: { type: "tool"; messageID: string; id: string };
  effect: "allow" | "ask" | "deny";
  message?: string;
}
export interface ReviewInput {
  resources: readonly string[];
  command: string;
  context: readonly string[];
}
export interface Reviewer {
  generate(prompt: string, signal: AbortSignal): Promise<string>;
}
export const ask = (code: string, fallback = true): Outcome => ({
  decision: "ask",
  riskLevel: "medium",
  reason: "Manual review required.",
  code,
  fallback,
});
