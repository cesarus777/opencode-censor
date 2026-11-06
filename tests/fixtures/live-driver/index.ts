// Test-only host probe. It asserts permissions but NEVER executes a command.
import { Plugin } from "@opencode/plugin";
import { appendFile } from "node:fs/promises";

export default Plugin.define({
  id: "opencode-censor-live-probe",
  async setup(ctx) {
    const reportFile = ctx.options.reportFile;
    if (typeof reportFile !== "string") throw new Error("Missing probe output");
    const write = (record: unknown) =>
      appendFile(reportFile, JSON.stringify(record) + "\n");
    const registration = await ctx.permission.hook(
      "evaluate",
      async (event) => {
        await write({
          type: "evaluated",
          resources: event.resources,
          effect: event.effect,
        });
      },
    );
    let closed = false;
    const timer = setTimeout(() => {
      void (async () => {
        const session = await ctx.session.create({
          title: "OpenCode Censor native smoke",
        });
        await write({ type: "session", sessionID: session.id });
        try {
          await ctx.permission.assert({
            sessionID: session.id,
            action: "shell",
            resources: ["git push --force"],
          });
          await write({ type: "deny-bypassed" });
        } catch {
          await write({ type: "deny-preserved" });
        }
        if (closed) return;
        // No tool source: the gate MUST ask rather than guess the original script.
        await ctx.permission.assert({
          sessionID: session.id,
          action: "shell",
          resources: ["pwd"],
        });
        await write({ type: "unexpected-approval" });
      })().catch(async () => {
        if (!closed) await write({ type: "probe-error" });
      });
    }, 250);
    return async () => {
      closed = true;
      clearTimeout(timer);
      await registration.dispose();
    };
  },
});
