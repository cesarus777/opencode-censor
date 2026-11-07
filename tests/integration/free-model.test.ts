import { describe, expect, test } from "bun:test";
import type { ModelInfo } from "@opencode/client";
import { selectFreeModel } from "../../scripts/free-model.js";

const free: ModelInfo = {
  id: "fixture-free",
  modelID: "fixture-free",
  providerID: "opencode",
  name: "Synthetic free reviewer",
  type: "chat",
  enabled: true,
  status: "active",
  capabilities: { tools: false, input: ["text"], output: ["text"] },
  variants: [],
  time: { released: 0 },
  limit: { context: 1000, output: 100 },
  cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
};
describe("free reviewer selection", () => {
  test("accepts an explicit built-in text model with zero prices", () => {
    expect(selectFreeModel([free], free.id)).toBe(free);
  });
  test("rejects missing, duplicate and other-provider models without fallback", () => {
    for (const models of [[], [free, free], [{ ...free, providerID: "other" }]])
      expect(() => selectFreeModel(models, free.id)).toThrow();
  });
  test("rejects unknown prices, paid tiers and cache charges", () => {
    for (const cost of [
      [],
      [{ input: 1, output: 0, cache: { read: 0, write: 0 } }],
      [...free.cost, { input: 0, output: 1, cache: { read: 0, write: 0 } }],
      [{ input: 0, output: 0, cache: { read: 1, write: 0 } }],
      [{ input: 0, output: 0, cache: { read: 0, write: 1 } }],
      [{ input: NaN, output: 0, cache: { read: 0, write: 0 } }],
    ])
      expect(() => selectFreeModel([{ ...free, cost }], free.id)).toThrow();
  });
  test("rejects disabled, deprecated and nontext models", () => {
    for (const model of [
      { ...free, enabled: false },
      { ...free, status: "deprecated" as const },
      { ...free, type: "image" as const },
      { ...free, capabilities: { ...free.capabilities, output: ["image"] } },
    ])
      expect(() => selectFreeModel([model], free.id)).toThrow();
  });
});
