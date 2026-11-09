import type { AuditStage, SourceDetail } from "../observability/diagnostics.js";
import type { Config } from "../config/schema.js";
import { parseConfig } from "../config/schema.js";
import { audit, type AuditRecord } from "../observability/logger.js";
import {
  ask,
  type PermissionEvent,
  type Reviewer,
  type SourceSnapshot,
  type Outcome,
} from "../types.js";
import type { EvidenceSource } from "./project-review.js";
import {
  inspectWorkdir,
  WorkdirFailure,
  type DirectorySnapshot,
} from "./workdir.js";
import { ReviewEngine } from "./review-engine.js";

export interface GateDependencies {
  options: unknown;
  directory?: string;
  reviewer: (config: Config) => Reviewer;
  command: (
    event: PermissionEvent,
  ) => string | SourceSnapshot | undefined | { detailCode: SourceDetail };
  context: (sessionID: string, config: Config) => Promise<readonly string[]>;
  project?: (config: Config) => EvidenceSource;
  log?: (record: AuditRecord) => void;
}
export function createGate(deps: GateDependencies) {
  let config: Config | undefined;
  try {
    config = parseConfig(deps.options);
  } catch {
    /* Register a fail-safe hook even for invalid options. */
  }
  const engine = config?.enabled
    ? new ReviewEngine(config, deps.reviewer(config), deps.project?.(config))
    : undefined;
  let closed = false;
  return {
    async evaluate(event: PermissionEvent): Promise<void> {
      if (
        event.action !== "shell" ||
        event.effect === "deny" ||
        config?.enabled === false
      )
        return;
      const started = performance.now();
      // Downgrade existing allow immediately; exceptions must never preserve it.
      event.effect = "ask";
      let result = ask(closed ? "unloaded" : "invalid_configuration");
      let command: string | undefined;
      let errorStage: AuditStage = "source";
      const resourceCount = event.resources.length;
      try {
        if (!closed && engine && config) {
          const captured = deps.command(event);
          const snapshot: SourceSnapshot | undefined =
            typeof captured === "string"
              ? { command: captured }
              : captured && "command" in captured
                ? { ...captured }
                : undefined;
          command = snapshot?.command;
          const sourceKey = JSON.stringify([
            event.sessionID,
            event.source?.messageID,
            event.source?.id,
          ]);
          const resources = [...event.resources];
          let directory: DirectorySnapshot | undefined;
          const changed = (): Outcome | undefined => {
            const current = deps.command(event);
            const source =
              typeof current === "string" ? { command: current } : current;
            const commandChanged =
              JSON.stringify([
                event.sessionID,
                event.source?.messageID,
                event.source?.id,
              ]) !== sourceKey ||
              !source ||
              !("command" in source) ||
              source.command !== snapshot?.command ||
              source.workdir !== snapshot?.workdir;
            const resourcesChanged =
              event.resources.length !== resources.length ||
              resources.some(
                (resource, index) => event.resources[index] !== resource,
              );
            return commandChanged || resourcesChanged
              ? {
                  ...ask("input_changed"),
                  stage: "recheck",
                  detailCode: commandChanged
                    ? "source_input_changed"
                    : "scanner_resources_changed",
                }
              : undefined;
          };
          const checkDirectory = async (
            signal: AbortSignal,
          ): Promise<Outcome | undefined> => {
            if (!deps.directory || !snapshot) return undefined;
            try {
              const current = await inspectWorkdir(
                deps.directory,
                snapshot.workdir,
                signal,
              );
              if (directory && directory.identity !== current.identity)
                return {
                  ...ask("input_changed"),
                  stage: "recheck",
                  detailCode: "workdir_changed",
                };
              directory = current;
              return undefined;
            } catch (error) {
              return {
                ...ask("missing_full_command"),
                stage: "source",
                detailCode:
                  error instanceof WorkdirFailure
                    ? error.code
                    : "invalid_workdir",
              };
            }
          };
          result = !snapshot
            ? {
                ...ask("missing_full_command"),
                stage: "source",
                detailCode:
                  captured &&
                  typeof captured === "object" &&
                  "detailCode" in captured
                    ? captured.detailCode
                    : "capture_missing",
              }
            : await engine.review(
                { command: snapshot.command, resources, context: [] },
                config.context.enabled
                  ? () => deps.context(event.sessionID, config)
                  : undefined,
                event.sessionID,
                {
                  started,
                  async prepare(signal) {
                    const failure =
                      changed() ?? (await checkDirectory(signal)) ?? changed();
                    return (
                      failure ?? {
                        command: snapshot.command,
                        resources,
                        context: [],
                        ...(directory ? { workdir: directory.workdir } : {}),
                      }
                    );
                  },
                  async recheck(signal) {
                    errorStage = "recheck";
                    return (
                      changed() ?? (await checkDirectory(signal)) ?? changed()
                    );
                  },
                },
              );
        }
      } catch {
        result = {
          ...result,
          ...ask("gate_error"),
          stage: errorStage,
          detailCode: "gate_error",
        };
      }
      // Another hook changing the event to deny while we awaited must win.
      if ((event.effect as PermissionEvent["effect"]) === "deny") return;
      if (closed)
        result = {
          ...result,
          ...ask("unloaded"),
          stage: "lifecycle",
          detailCode: "unloaded",
        };
      event.effect = result.decision;
      event.message = `OpenCode Censor: ${result.code.replaceAll("_", " ")}.`;
      audit(
        config?.logging ?? {
          enabled: true,
          level: "info",
          includeCommands: false,
          file: "",
        },
        result,
        performance.now() - started,
        deps.log,
        {
          sessionID: event.sessionID,
          resourceCount,
          ...(config
            ? { strategy: config.review.strategy, mode: config.mode }
            : {}),
          ...(command !== undefined ? { command } : {}),
        },
      );
    },
    close() {
      closed = true;
      engine?.close();
    },
  };
}
