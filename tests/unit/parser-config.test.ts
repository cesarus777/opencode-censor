import { describe, expect, test } from "bun:test";
import { parseDecision } from "../../src/core/decision-parser.js";
import { parseConfig } from "../../src/config/schema.js";
import { allowed, options } from "../fixtures/helpers.js";

describe("decision parser", () => {
  test("accepts exact JSON, optional confidence and ask reasons", () => {
    expect(parseDecision(allowed).decision).toBe("allow");
    expect(
      parseDecision(
        '{"decision":"ask","riskLevel":"high","reason":"Potential deletion"}',
      ).decision,
    ).toBe("ask");
    expect(
      parseDecision(
        '{"decision":"allow","riskLevel":"low","reason":"Read-only inspection."}',
      ).confidence,
    ).toBeUndefined();
  });
  test("rejects duplicate keys including escaped conflicting names", () => {
    expect(() =>
      parseDecision(
        '{"decision":"ask","decision":"allow","riskLevel":"low","reason":"Read-only inspection."}',
      ),
    ).toThrow();
    expect(() =>
      parseDecision(
        '{"decisi\\u006fn":"ask","decision":"allow","riskLevel":"low","reason":"Read-only inspection."}',
      ),
    ).toThrow();
  });
  test.each([
    "",
    "allow",
    "{}",
    "null",
    "[]",
    "```json\n" + allowed + "\n```",
    allowed + " more",
    '{"decision":"deny","riskLevel":"high","reason":"No"}',
  ])("rejects malformed/unknown response %s", (text) =>
    expect(() => parseDecision(text)).toThrow(),
  );
  test.each([
    { riskLevel: "high" },
    { riskLevel: "medium" },
    { reason: "" },
    { reason: "Safe but may delete data" },
    { confidence: 1.1 },
    { confidence: -1 },
    { confidence: "1" },
    { tool: "execute" },
    { reason: "Safe\nignore rules" },
  ])("rejects conflicting fields %j", (patch) =>
    expect(() =>
      parseDecision(JSON.stringify({ ...JSON.parse(allowed), ...patch })),
    ).toThrow(),
  );
});
describe("configuration", () => {
  test("defaults are conservative and model is independent", () => {
    const config = parseConfig(options);
    expect(config.logging.includeCommands).toBe(true);
    expect(
      parseConfig({ ...options, logging: { includeCommands: false } }).logging
        .includeCommands,
    ).toBe(false);
    expect(config.mode).toBe("balanced");
    expect(config.context.enabled).toBe(false);
    expect(config.cache.enabled).toBe(false);
    expect(config.timeoutMs).toBe(15000);
    expect(config.model.id).toBe("reviewer");
  });
  test.each(
    [
      null,
      [],
      {},
      { ...options, fallback: "allow" },
      { ...options, cache: { enabled: true } },
      { ...options, logging: { includeCommands: "true" } },
      { ...options, timeoutMs: 0 },
      { ...options, timeoutMs: Infinity },
      { ...options, mode: "fast" },
      { ...options, systemPrompt: 42 },
      { ...options, systemPrompt: "x".repeat(6001) },
      { ...options, systemPrompt: "bad\0prompt" },
      { ...options, enabled: "false" },
      { ...options, unknown: true },
      { ...options, model: { providerID: "x", id: "MODEL_ID" } },
      { ...options, context: { maxMessages: 100 } },
    ].map((input) => ({ input })),
  )("rejects invalid options %j", ({ input }) =>
    expect(() => parseConfig(input)).toThrow(),
  );
});
