// Test-only native driver. The shell implementation is replaced before any
// session runs: reviewed strings are NEVER passed to a shell or subprocess.
import { Plugin } from "@opencode/plugin";
import { appendFile } from "node:fs/promises";

export default Plugin.define({
  id: "opencode-censor-live-probe",
  async setup(ctx) {
    const { reportFile, providerURL } = ctx.options;
    if (typeof reportFile !== "string" || typeof providerURL !== "string")
      throw new Error("Missing probe paths");
    const write = (record: unknown) =>
      appendFile(reportFile, JSON.stringify(record) + "\n");
    const registrations: { dispose(): Promise<void> }[] = [];
    registrations.push(
      await ctx.session.hook("http.request", (event) => {
        if (new URL(event.request.url).origin !== new URL(providerURL).origin)
          throw new Error("Remote provider traffic prohibited in native smoke");
      }),
    );
    registrations.push(
      await ctx.session.hook("title", (event) => {
        event.result = "Inert native probe";
      }),
    );
    const eventController = new AbortController();
    void (async () => {
      for await (const event of ctx.event.subscribe({
        types: ["session.execution.failed"],
        signal: eventController.signal,
      }))
        await write({
          type: "session-error",
          sessionID: event.data.sessionID,
          error: event.data.error.type,
        });
    })().catch(() => {});
    registrations.push(
      await ctx.shell.hook("create.before", async () => {
        await write({ type: "shell-execution-blocked" });
        throw new Error("Shell execution prohibited in native smoke");
      }),
    );
    registrations.push(
      await ctx.tool.transform((editor) => {
        if (!editor.get("shell")) throw new Error("Native shell tool missing");
        editor.update("shell", (tool) => {
          tool.execute = async (input: unknown, context) => {
            if (
              !input ||
              typeof input !== "object" ||
              !("command" in input) ||
              typeof input.command !== "string"
            )
              throw new Error("Invalid inert input");
            await ctx.permission.assert({
              sessionID: context.sessionID,
              action: "shell",
              resources: [input.command],
              source: {
                type: "tool",
                messageID: context.messageID,
                id: context.id,
              },
            });
            await write({
              type: "inert-allowed",
              sessionID: context.sessionID,
            });
            return { content: "Inert permission probe; no command executed." };
          };
        });
      }),
    );
    registrations.push(
      await ctx.tool.hook("execute.before", async (event) => {
        if (event.tool === "shell")
          await write({
            type: "source",
            sessionID: event.sessionID,
            messageID: event.messageID,
            id: event.id,
          });
      }),
    );
    registrations.push(
      await ctx.permission.hook("evaluate", async (event) => {
        await write({
          type: "evaluated",
          sessionID: event.sessionID,
          effect: event.effect,
          message: event.message,
        });
      }),
    );
    registrations.push(
      await ctx.tool.hook("execute.after", async (event) => {
        if (event.tool !== "shell") return;
        await write({ type: "tool-completed", sessionID: event.sessionID });
      }),
    );
    const missingTimer = setTimeout(() => {
      void (async () => {
        const session = await ctx.session.create({
          title: "Missing source probe",
        });
        await write({ type: "missing-session", sessionID: session.id });
        await ctx.permission.assert({
          sessionID: session.id,
          action: "shell",
          resources: ["pwd"],
        });
        await write({ type: "unexpected-missing-allow" });
      })().catch(() => {});
    }, 100);
    await write({ type: "driver-ready" });
    return async () => {
      clearTimeout(missingTimer);
      eventController.abort();
      await Promise.allSettled(
        registrations.map((registration) => registration.dispose()),
      );
      await write({ type: "driver-unloaded" });
    };
  },
});
