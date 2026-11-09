import { expect, test } from "bun:test";
import { countAudit, summarizeAudit } from "../../src/stats.js";

test("counts automatic approvals over audited shell evaluations", () => {
  expect(
    countAudit(
      '{"action":"shell","decision":"allow"}\n{"action":"shell","decision":"ask"}\n',
    ),
  ).toEqual({ total: 2, allow: 1, ask: 1 });
  expect(countAudit("")).toEqual({ total: 0, allow: 0, ask: 0 });
});
test("rejects malformed audit lines instead of reporting misleading totals", () => {
  expect(() => countAudit('{"action":"shell","decision":"deny"}\n')).toThrow();
  expect(() => countAudit("broken\n")).toThrow();
});

test("mixed audit versions report reviewer reach without treating unknown legacy calls as zero", () => {
  const result = summarizeAudit(
    [
      {
        action: "shell",
        decision: "ask",
        reason: "policy_requires_review",
        detailCode: "resource_command_mismatch",
        reviewCalls: 0,
      },
      {
        action: "shell",
        decision: "ask",
        reason: "review_error",
        reviewCalls: 1,
      },
      {
        action: "shell",
        decision: "allow",
        reason: "review_allowed",
        reviewerDecision: "allow",
      },
      { action: "shell", decision: "ask", reason: "policy_requires_review" },
    ]
      .map((value) => JSON.stringify(value))
      .join("\n"),
  );
  expect(result).toMatchObject({
    total: 4,
    reviewerReached: 2,
    reviewerSkipped: 1,
    reviewerUnknown: 1,
  });
  expect(result.reasons).toEqual({
    policy_requires_review: 2,
    review_error: 1,
    review_allowed: 1,
  });
  expect(result.details).toEqual({ resource_command_mismatch: 1, unknown: 3 });
});

test("statistics reject invalid call counts and do not echo arbitrary text or prototype properties", () => {
  for (const reviewCalls of [-1, 0.5, "1", null])
    expect(() =>
      summarizeAudit(
        JSON.stringify({ action: "shell", decision: "ask", reviewCalls }),
      ),
    ).toThrow();
  const result = summarizeAudit(
    JSON.stringify({
      action: "shell",
      decision: "ask",
      reason: "constructor",
      detailCode: "PRIVATE\ntext",
    }),
  );
  expect(Object.entries(result.reasons)).toEqual([["constructor", 1]]);
  expect(result.details).toEqual({ unknown: 1 });
});

test("statistics report selected paths and queue waits without exposing commands", () => {
  const summary = summarizeAudit(
    [
      {
        action: "shell",
        decision: "allow",
        reviewPath: "inspection",
        queueWaitMs: 0,
      },
      {
        action: "shell",
        decision: "ask",
        reviewPath: "project",
        queueWaitMs: 12,
      },
      {
        action: "shell",
        decision: "ask",
        reviewPath: "project",
        queueWaitMs: 7,
      },
      { action: "shell", decision: "ask" },
    ]
      .map((record) => JSON.stringify(record))
      .join("\n"),
  );
  expect(summary.reviewPaths).toEqual({
    inspection: 1,
    project: 2,
    unknown: 1,
  });
  expect(summary).toMatchObject({
    queued: 2,
    totalQueueWaitMs: 19,
    maxQueueWaitMs: 12,
  });
  for (const queueWaitMs of [-1, 0.5, "1", null])
    expect(() =>
      summarizeAudit(
        JSON.stringify({ action: "shell", decision: "ask", queueWaitMs }),
      ),
    ).toThrow();
});
