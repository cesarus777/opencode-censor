import type { ModelInfo } from "@opencode/client";

// Empty pricing is unknown, not free. Check every tier, including cache prices.
export function selectFreeModel(
  models: readonly ModelInfo[],
  id: string,
): ModelInfo {
  const matches = models.filter(
    (model) => model.providerID === "opencode" && model.id === id,
  );
  if (matches.length !== 1)
    throw new Error("Requested built-in model unavailable or ambiguous");
  const model = matches[0]!;
  if (
    !model.enabled ||
    model.status === "deprecated" ||
    (model.type !== undefined && model.type !== "chat") ||
    !model.capabilities.output.includes("text") ||
    model.cost.length === 0 ||
    !model.cost.every(
      (tier) =>
        tier.input === 0 &&
        tier.output === 0 &&
        tier.cache.read === 0 &&
        tier.cache.write === 0,
    )
  )
    throw new Error(
      "Requested model lacks explicit zero pricing or is unavailable",
    );
  return model;
}
