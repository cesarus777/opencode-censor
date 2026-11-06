import { parseConfig } from "../../src/config/schema.js";
import type { PermissionEvent } from "../../src/types.js";

export const options = {
  model: { providerID: "test", id: "reviewer" },
  logging: { enabled: false },
};
export const config = () => parseConfig(options);
export const allowed = JSON.stringify({
  decision: "allow",
  riskLevel: "low",
  reason: "Read-only inspection.",
  confidence: 0.99,
});
export const event = (resources = ["pwd"]): PermissionEvent => ({
  sessionID: "s1",
  action: "shell",
  resources,
  effect: "ask",
  source: { type: "tool", messageID: "m1", id: "c1" },
});
