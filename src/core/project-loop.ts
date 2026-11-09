import { createHash } from "node:crypto";
import type { Config } from "../config/schema.js";
import {
  ask,
  type Outcome,
  type ReviewInput,
  type Reviewer,
} from "../types.js";
import { containsSensitiveData } from "../security/sanitization.js";
import { buildProjectPrompt } from "../llm/prompt.js";
import {
  parseProjectResponse,
  type ProjectDecision,
} from "./project-protocol.js";
import type {
  EvidenceResult,
  EvidenceSource,
  EvidenceStamp,
} from "./project-review.js";

interface Finding {
  commandHash: string;
  effects: ProjectDecision["effects"];
  riskLevel: ProjectDecision["riskLevel"];
  reasonCode: ProjectDecision["reasonCode"];
  stamps: EvidenceStamp[];
}
interface SessionState {
  expires: number;
  findings: Finding[];
}
export function projectFailure(
  input: ReviewInput,
  config: Config,
): string | undefined {
  if (config.review.strategy !== "stateful") return "stateful_disabled";
  if (!input.command.trim()) return "command_empty";
  if (input.command.length > 8192) return "command_too_long";
  if (input.resources.length === 0) return "resources_missing";
  if (input.resources.length > 32) return "too_many_resources";
  const strings = [input.command, ...input.resources];
  if (strings.reduce((sum, value) => sum + value.length, 0) > 16384)
    return "input_budget_exceeded";
  if (strings.some((value) => containsSensitiveData(value)))
    return "sensitive_input";
  if (strings.some((value) => /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)))
    return "control_characters";
  if (
    !config.review.allowShellSyntax &&
    /[\\\n;&|`$<>(){}]/.test(input.command)
  )
    return "shell_syntax_disabled";
  if (
    config.review.alwaysAsk.some((fragment) => input.command.includes(fragment))
  )
    return "always_ask_match";
  return undefined;
}
export function projectEligible(input: ReviewInput, config: Config): boolean {
  return projectFailure(input, config) === undefined;
}
export class ProjectLoop {
  private readonly sessions = new Map<string, SessionState>();
  private closed = false;
  constructor(
    private readonly config: Config,
    private readonly source: EvidenceSource,
    private readonly reviewer: Reviewer,
  ) {}
  close(): void {
    this.closed = true;
    this.sessions.clear();
  }
  async review(
    input: ReviewInput,
    sessionID: string,
    signal: AbortSignal,
    onProgress?: (stage: "reviewer" | "evidence" | "recheck") => void,
  ): Promise<Outcome> {
    const commandHash = createHash("sha256")
      .update(input.command)
      .digest("hex");
    const evidence = this.source.create(signal);
    const results: EvidenceResult[] = [];
    const requests = new Set<string>();
    let calls = 0;
    const stop = (code: string): Outcome => ({
      ...ask(code),
      reviewCalls: calls,
      evidenceCount: results.length,
    });
    const current = () => !this.closed && !signal.aborted;
    const now = Date.now();
    for (const [key, entry] of this.sessions)
      if (entry.expires <= now) this.sessions.delete(key);
    const previous = this.sessions.get(sessionID);
    // These are discovery hints, never previous decisions or authorization.
    const previousFiles = [
      ...new Set(
        previous?.findings.flatMap((finding) =>
          finding.stamps
            .filter((stamp) => stamp.action === "read")
            .map((stamp) => stamp.path),
        ) ?? [],
      ),
    ].slice(0, 32);
    const overview = { action: "list", path: "." } as const;
    requests.add(JSON.stringify(overview));
    results.push(await evidence.request(overview));
    if (!current()) return stop("cancelled");
    if (results[0]?.status !== "ok")
      return stop(results[0]?.code ?? "evidence_unavailable");
    for (; calls < this.config.review.maxModelCalls; ) {
      if (!current()) return stop("cancelled");
      const stamps = evidence.stamps();
      const verifiedFindings =
        previous?.findings
          .filter(
            (finding) =>
              finding.commandHash === commandHash &&
              finding.stamps.every((old) =>
                stamps.some(
                  (stamp) =>
                    old.action === stamp.action &&
                    old.path === stamp.path &&
                    old.fingerprint === stamp.fingerprint,
                ),
              ),
          )
          .map(({ effects, riskLevel, reasonCode }) => ({
            effects,
            riskLevel,
            reasonCode,
          })) ?? [];
      calls++;
      let text: string;
      try {
        const prompt = buildProjectPrompt(
          input,
          results,
          previousFiles,
          verifiedFindings,
          this.config,
        );
        onProgress?.("reviewer");
        text = await this.reviewer.generate(prompt, signal);
      } catch {
        return stop("review_error");
      }
      if (!current()) return stop("cancelled");
      let response;
      try {
        response = parseProjectResponse(text);
      } catch {
        return stop("invalid_review_response");
      }
      if (response.action !== "decide") {
        const key = JSON.stringify(response);
        if (requests.has(key)) return stop("evidence_no_progress");
        if (calls >= this.config.review.maxModelCalls)
          return stop("review_budget");
        requests.add(key);
        onProgress?.("evidence");
        const result = await evidence.request(response);
        results.push(result);
        if (!current()) return stop("cancelled");
        continue;
      }
      const metadata = {
        reviewerConfidence: response.confidence,
        reviewerDecision: response.decision,
        reviewerRiskLevel: response.riskLevel,
        reviewerReasonCode: response.reasonCode,
        reviewCalls: calls,
        evidenceCount: results.length,
      };
      if (
        response.evidence.some(
          (id) =>
            !results.some(
              (result) => result.id === id && result.status === "ok",
            ),
        )
      )
        return { ...stop("invalid_evidence_reference"), ...metadata };
      const unavailable = results.find((result) => result.status !== "ok");
      if (unavailable)
        return {
          ...stop(unavailable.code ?? "evidence_unavailable"),
          ...metadata,
        };
      if (
        response.decision === "allow" &&
        !response.evidence.some((id) =>
          results.some(
            (result) =>
              result.id === id &&
              result.request.action === "read" &&
              result.status === "ok",
          ),
        )
      )
        return { ...stop("project_incomplete"), ...metadata };
      onProgress?.("recheck");
      if (!(await evidence.unchanged()))
        return { ...stop("project_changed"), ...metadata };
      if (!current()) return stop("cancelled");
      // Retain only structured findings grounded in a successful full-file read.
      if (
        results.some(
          (result) =>
            result.request.action === "read" && result.status === "ok",
        )
      ) {
        const finding: Finding = {
          commandHash,
          effects: response.effects,
          riskLevel: response.riskLevel,
          reasonCode: response.reasonCode,
          stamps: evidence.stamps(),
        };
        if (!this.sessions.has(sessionID) && this.sessions.size >= 32) {
          const oldest = this.sessions.keys().next().value;
          if (oldest !== undefined) this.sessions.delete(oldest);
        }
        const stamps = evidence.stamps();
        const retained = (previous?.findings ?? []).filter(
          (oldFinding) =>
            !oldFinding.stamps.some((old) =>
              stamps.some(
                (stamp) =>
                  old.action === stamp.action &&
                  old.path === stamp.path &&
                  old.fingerprint !== stamp.fingerprint,
              ),
            ),
        );
        this.sessions.set(sessionID, {
          expires: previous?.expires ?? now + 300000,
          findings: [...retained.slice(-7), finding],
        });
      }
      const allowed =
        response.decision === "allow" &&
        response.riskLevel === "low" &&
        !response.uncertain &&
        response.reasonCode === "understood_operation" &&
        !response.effects.includes("unknown") &&
        !response.effects.some((effect) =>
          this.config.review.forbiddenEffects.includes(effect),
        ) &&
        response.confidence >=
          { strict: 0.98, balanced: 0.9, permissive: 0.8 }[this.config.mode];
      return {
        ...ask(
          allowed ? "project_review_allowed" : "project_requires_approval",
          false,
        ),
        stage: "reviewer",
        detailCode: allowed
          ? "project_review_allowed"
          : response.decision !== "allow"
            ? "reviewer_requested_approval"
            : response.riskLevel !== "low"
              ? "reviewer_risk_above_low"
              : response.uncertain
                ? "reviewer_uncertain"
                : response.reasonCode !== "understood_operation"
                  ? "reviewer_reason_not_approved"
                  : response.effects.includes("unknown")
                    ? "reviewer_unknown_effects"
                    : response.effects.some((effect) =>
                          this.config.review.forbiddenEffects.includes(effect),
                        )
                      ? "reviewer_forbidden_effect"
                      : "reviewer_confidence_below_floor",
        decision: allowed ? "allow" : "ask",
        riskLevel: response.riskLevel,
        ...metadata,
      };
    }
    return stop("review_budget");
  }
}
