import { Plugin } from "@opencode/plugin";
import { resolve, relative, isAbsolute } from "node:path";
import { object, parseConfig } from "./config/schema.js";
import { fileAuditSink } from "./observability/file.js";
import { ProjectEvidence } from "./core/project-review.js";
import { createGate } from "./core/permission-gate.js";
import { nativeReviewer } from "./llm/reviewer.js";
import { intentContext } from "./security/sanitization.js";
import type { PermissionEvent } from "./types.js";

const key = (sessionID: string, messageID: string, id: string) =>
  JSON.stringify([sessionID, messageID, id]);

export default Plugin.define({
  id: "opencode-censor",
  async setup(ctx) {
    let active = true;
    // Correlate the native tool input with the permission source. Never treat a
    // scanner resource or undocumented metadata field as the complete script.
    const calls = new Map<
      string,
      { input: Record<string, unknown>; expires: number }
    >();
    const registrations: { dispose(): Promise<void> }[] = [];
    let stateful = false;
    let log: ReturnType<typeof fileAuditSink> | undefined;
    try {
      const config = parseConfig(ctx.options);
      stateful = config.review.strategy === "stateful";
      log = fileAuditSink(config.logging.file);
    } catch {
      // Invalid configuration is still audited to stderr by the gate.
    }
    const gate = createGate({
      ...(log ? { log } : {}),
      options: ctx.options,
      project: (config) =>
        new ProjectEvidence(ctx.location.directory, config.review.project),
      reviewer: (config) => nativeReviewer(ctx, config),
      command(event: PermissionEvent) {
        const source = event.source;
        if (!source) return undefined;
        const call = calls.get(
          key(event.sessionID, source.messageID, source.id),
        );
        if (!call || call.expires < Date.now()) return undefined;
        const workdir = call.input.workdir;
        if (workdir !== undefined) {
          if (typeof workdir !== "string") return undefined;
          // Project snapshots are rooted at the project directory, so stateful
          // review rejects a different working directory, including later edits.
          if (
            stateful &&
            resolve(ctx.location.directory, workdir) !==
              resolve(ctx.location.directory)
          )
            return undefined;
          const path = relative(
            ctx.location.directory,
            resolve(ctx.location.directory, workdir),
          );
          if (
            path === ".." ||
            path.startsWith("../") ||
            path.startsWith("..\\") ||
            isAbsolute(path)
          )
            return undefined;
        }
        return typeof call.input.command === "string"
          ? call.input.command
          : undefined;
      },
      async context(sessionID, config) {
        const messages = await ctx.session.context({ sessionID });
        return intentContext(
          messages,
          config.context.maxMessages,
          config.context.maxCharacters,
        );
      },
    });
    try {
      registrations.push(
        await ctx.tool.hook("execute.before", (event) => {
          if (!active || event.tool !== "shell" || !object(event.input)) return;
          const now = Date.now();
          for (const [id, call] of calls)
            if (call.expires < now) calls.delete(id);
          if (calls.size >= 256) return; // Missing correlation safely becomes ask.
          calls.set(key(event.sessionID, event.messageID, event.id), {
            input: event.input,
            expires: now + 60000,
          });
        }),
      );
      registrations.push(
        await ctx.tool.hook("execute.after", (event) => {
          calls.delete(key(event.sessionID, event.messageID, event.id));
        }),
      );
      registrations.push(await ctx.permission.hook("evaluate", gate.evaluate));
    } catch (error) {
      active = false;
      gate.close();
      calls.clear();
      await Promise.allSettled(
        registrations.map((registration) => registration.dispose()),
      );
      throw error;
    }
    return async () => {
      active = false;
      gate.close();
      calls.clear();
      await Promise.allSettled(
        registrations.map((registration) => registration.dispose()),
      );
    };
  },
});
