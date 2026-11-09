import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AuditRecord } from "../../src/observability/logger.js";
import { fileAuditSink } from "../../src/observability/file.js";

test("dedicated audit sink appends one private JSON line per decision", () => {
  const path = join(
    mkdtempSync(join(tmpdir(), "censor-audit-")),
    "nested",
    "audit.jsonl",
  );
  const sink = fileAuditSink(path);
  const record: AuditRecord = {
    schemaVersion: 2,
    strategy: "stateless",
    mode: "balanced",
    stage: "reviewer",
    detailCode: "review_allowed",
    resourceCount: 1,
    reviewCalls: 1,
    timestamp: "2026-11-07T00:00:00.000Z",
    action: "shell" as const,
    decision: "allow" as const,
    riskLevel: "low" as const,
    durationMs: 1,
    reason: "review_allowed",
    fallback: false,
  };
  sink(record);
  sink({ ...record, decision: "ask" });
  expect(
    readFileSync(path, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line).decision),
  ).toEqual(["allow", "ask"]);
});
