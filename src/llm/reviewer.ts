import type { Plugin } from "@opencode/plugin";
import type { Config } from "../config/schema.js";
import type { Reviewer } from "../types.js";

export function nativeReviewer(
  ctx: Pick<Plugin.Context, "experimental">,
  config: Config,
): Reviewer {
  return {
    async generate(prompt, signal) {
      if (signal.aborted) throw new Error("Cancelled");
      // SDK accepts requestOptions; 2.2.5's local Promise adapter currently ignores
      // them. ReviewEngine independently bounds the wait and discards late output.
      const result = await ctx.experimental.generate.text(
        { model: config.model, prompt },
        { signal },
      );
      if (signal.aborted) throw new Error("Cancelled");
      return result.text;
    },
  };
}
