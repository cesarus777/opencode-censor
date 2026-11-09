import { expect, test } from "bun:test";
import { createGate } from "../../src/core/permission-gate.js";
import { ReviewEngine } from "../../src/core/review-engine.js";
import { applyPolicy } from "../../src/core/policy-engine.js";
import { audit, type AuditRecord } from "../../src/observability/logger.js";
import { allowed, config, event, options } from "../fixtures/helpers.js";

const input = { command: "ls", resources: ["ls"], context: [] };
function record(outcome: Awaited<ReturnType<ReviewEngine["review"]>>) {
  let result!: AuditRecord;
  audit({ ...config().logging, enabled: true }, outcome, 1, (value) => {
    result = value;
  });
  return result;
}

test.each([
  [[], "ls", "resources_missing"],
  [["ls", "pwd"], "ls", "multiple_resources"],
  [["ls *"], "ls", "resource_command_mismatch"],
  [["ls ."], "ls .", "command_outside_grammar"],
] as const)(
  "policy diagnostics identify the first failed check: %j",
  async (resources, command, detailCode) => {
    const engine = new ReviewEngine(config(), {
      generate: async () => {
        throw new Error("must not call reviewer");
      },
    });
    const value = record(await engine.review({ ...input, resources, command }));
    expect(value).toMatchObject({
      schemaVersion: 2,
      reason: "policy_requires_review",
      stage: "policy",
      detailCode,
      reviewCalls: 0,
      decision: "ask",
    });
    engine.close();
  },
);

test("validated confidence and model call counts are audited without model prose", async () => {
  const engine = new ReviewEngine(config(), {
    generate: async () =>
      JSON.stringify({
        decision: "ask",
        riskLevel: "low",
        reason: "PRIVATE provider prose",
        confidence: 0.93,
      }),
  });
  const value = record(await engine.review(input));
  expect(value).toMatchObject({
    detailCode: "reviewer_requested_approval",
    reviewCalls: 1,
    reviewerConfidence: 0.93,
    stage: "reviewer",
  });
  expect(JSON.stringify(value)).not.toContain("PRIVATE");
  engine.close();
});

test("local risk and confidence diagnostics do not change final decisions", () => {
  const review = {
    decision: "allow",
    riskLevel: "low",
    reason: "Read-only inspection.",
    confidence: 0.5,
  } as const;
  expect(applyPolicy(input, review, "balanced")).toMatchObject({
    decision: "ask",
    detailCode: "reviewer_confidence_below_floor",
  });
  expect(
    applyPolicy(input, { ...review, riskLevel: "high" }, "balanced"),
  ).toMatchObject({ decision: "ask", detailCode: "reviewer_risk_above_low" });
});

test("context failure and provider failure distinguish zero calls from an attempted call", async () => {
  const engine = new ReviewEngine(config(), {
    generate: async () => {
      throw new Error("PRIVATE error");
    },
  });
  expect(
    record(
      await engine.review(input, async () => {
        throw new Error("PRIVATE context");
      }),
    ),
  ).toMatchObject({
    reason: "review_error",
    detailCode: "context_error",
    stage: "context",
    reviewCalls: 0,
  });
  const value = record(await engine.review(input));
  expect(value).toMatchObject({
    reason: "review_error",
    detailCode: "provider_error",
    stage: "reviewer",
    reviewCalls: 1,
  });
  expect(JSON.stringify(value)).not.toContain("PRIVATE");
  engine.close();
});

test("timeouts snapshot call counts and stage; late results cannot change records", async () => {
  let finish!: (text: string) => void;
  const engine = new ReviewEngine(
    { ...config(), timeoutMs: 10 },
    {
      generate: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  );
  const provider = record(await engine.review(input));
  expect(provider).toMatchObject({
    reason: "timeout",
    stage: "reviewer",
    reviewCalls: 1,
  });
  const snapshot = JSON.stringify(provider);
  finish(allowed);
  await Bun.sleep(1);
  expect(JSON.stringify(provider)).toBe(snapshot);
  expect(
    record(await engine.review(input, () => new Promise(() => {}))),
  ).toMatchObject({ reason: "timeout", stage: "context", reviewCalls: 0 });
  engine.close();
});

test("rechecks retain reviewer metadata and original resource counts", async () => {
  const records: AuditRecord[] = [];
  const resources = ["ls"];
  const gate = createGate({
    options: { ...options, logging: { enabled: true } },
    command: () => "ls",
    context: async () => [],
    reviewer: () => ({
      generate: async () => {
        resources.push("pwd");
        return allowed;
      },
    }),
    log: (value) => records.push(value),
  });
  const value = event(resources);
  await gate.evaluate(value);
  expect(records[0]).toMatchObject({
    decision: "ask",
    reason: "input_changed",
    detailCode: "scanner_resources_changed",
    stage: "recheck",
    reviewCalls: 1,
    reviewerDecision: "allow",
    resourceCount: 1,
    mode: "balanced",
    strategy: "stateless",
  });
  gate.close();
});

test("invalid configuration has explicit unknown settings and no command", async () => {
  const records: AuditRecord[] = [];
  const gate = createGate({
    options: {},
    reviewer: () => {
      throw new Error("must not initialize");
    },
    command: () => "PRIVATE",
    context: async () => [],
    log: (value) => records.push(value),
  });
  await gate.evaluate(event());
  expect(records[0]).toMatchObject({
    stage: "configuration",
    detailCode: "invalid_configuration",
    strategy: "unknown",
    mode: "unknown",
    reviewCalls: 0,
  });
  expect(JSON.stringify(records)).not.toContain("PRIVATE");
  gate.close();
});

test("audit includes fixed path and queue duration alongside snapshot call counts", async () => {
  const engine = new ReviewEngine(config(), { generate: async () => allowed });
  const value = record(await engine.review(input));
  expect(value).toMatchObject({
    reviewPath: "inspection",
    queueWaitMs: 0,
    reviewCalls: 1,
    strategy: "unknown",
  });
  engine.close();
});
