#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { defaultAuditPath } from "./observability/path.js";

type Counts = { total: number; allow: number; ask: number };
export interface AuditSummary extends Counts {
  reviewerReached: number;
  reviewerSkipped: number;
  reviewerUnknown: number;
  reviewPaths: Record<string, number>;
  queued: number;
  totalQueueWaitMs: number;
  maxQueueWaitMs: number;
  reasons: Record<string, number>;
  details: Record<string, number>;
}
export function summarizeAudit(text: string): AuditSummary {
  const counts: AuditSummary = {
    total: 0,
    allow: 0,
    ask: 0,
    reviewerReached: 0,
    reviewerSkipped: 0,
    reviewerUnknown: 0,
    reviewPaths: {},
    queued: 0,
    totalQueueWaitMs: 0,
    maxQueueWaitMs: 0,
    reasons: {},
    details: {},
  };
  const increment = (map: Record<string, number>, value: unknown) => {
    const key =
      typeof value === "string" && /^[a-z][a-z0-9_]{0,79}$/.test(value)
        ? value
        : "unknown";
    Object.defineProperty(map, key, {
      value: (Object.hasOwn(map, key) ? map[key]! : 0) + 1,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  };
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error("Audit file contains an invalid JSON line");
    }
    if (
      typeof value !== "object" ||
      value === null ||
      !("action" in value) ||
      value.action !== "shell" ||
      !("decision" in value) ||
      (value.decision !== "allow" && value.decision !== "ask")
    )
      throw new Error("Audit file contains an invalid decision record");
    if ("reviewCalls" in value) {
      if (
        typeof value.reviewCalls !== "number" ||
        !Number.isSafeInteger(value.reviewCalls) ||
        value.reviewCalls < 0
      )
        throw new Error("Audit file contains an invalid review count");
      if (value.reviewCalls > 0) counts.reviewerReached++;
      else counts.reviewerSkipped++;
    } else if (
      "reviewerDecision" in value &&
      (value.reviewerDecision === "allow" || value.reviewerDecision === "ask")
    ) {
      counts.reviewerReached++;
    } else counts.reviewerUnknown++;
    increment(
      counts.reviewPaths,
      "reviewPath" in value &&
        (value.reviewPath === "inspection" || value.reviewPath === "project")
        ? value.reviewPath
        : undefined,
    );
    if ("queueWaitMs" in value) {
      if (
        typeof value.queueWaitMs !== "number" ||
        !Number.isSafeInteger(value.queueWaitMs) ||
        value.queueWaitMs < 0
      )
        throw new Error("Audit file contains an invalid queue duration");
      if (value.queueWaitMs > 0) counts.queued++;
      counts.totalQueueWaitMs += value.queueWaitMs;
      counts.maxQueueWaitMs = Math.max(
        counts.maxQueueWaitMs,
        value.queueWaitMs,
      );
    }
    increment(counts.reasons, "reason" in value ? value.reason : undefined);
    increment(
      counts.details,
      "detailCode" in value ? value.detailCode : undefined,
    );
    counts.total++;
    counts[value.decision]++;
  }
  return counts;
}

export function countAudit(text: string): Counts {
  const { total, allow, ask } = summarizeAudit(text);
  return { total, allow, ask };
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  const path = process.argv[2] ?? defaultAuditPath();
  if (process.argv.length > 3 || path === "--help") {
    console.log("Usage: censor-stats [audit.jsonl]");
    process.exit(path === "--help" ? 0 : 2);
  }
  try {
    const summary = summarizeAudit(readFileSync(path, "utf8"));
    const {
      total,
      allow,
      ask,
      reviewerReached,
      reviewerSkipped,
      reviewerUnknown,
    } = summary;
    console.log(`Audit file: ${path}`);
    console.log(
      `Automatic approvals: ${allow} / ${total} (${total ? ((allow / total) * 100).toFixed(1) : "0.0"}%)`,
    );
    console.log(`Sent to native approval: ${ask} / ${total}`);
    const known = reviewerReached + reviewerSkipped;
    console.log(
      `Reached reviewer: ${reviewerReached} / ${known} known (${known ? ((reviewerReached / known) * 100).toFixed(1) : "0.0"}%); unknown: ${reviewerUnknown}`,
    );
    console.log(
      `Queue waits: ${summary.queued}; total ${summary.totalQueueWaitMs} ms; maximum ${summary.maxQueueWaitMs} ms`,
    );
    for (const [label, counts] of [
      ["Review paths", summary.reviewPaths],
      ["Reasons", summary.reasons],
      ["Details", summary.details],
    ] as const) {
      console.log(`${label}:`);
      for (const [code, count] of Object.entries(counts).sort(
        ([a, x], [b, y]) => y - x || a.localeCompare(b),
      ))
        console.log(`  ${code}: ${count}`);
    }
    console.log(
      "Scope: shell evaluations audited by this plugin; native denies and later human decisions are excluded.",
    );
  } catch (error) {
    console.error(
      error instanceof Error && error.message.startsWith("Audit file")
        ? error.message
        : `Cannot read audit file: ${path}`,
    );
    process.exitCode = 1;
  }
}
