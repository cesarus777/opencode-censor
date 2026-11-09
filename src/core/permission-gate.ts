import type { AuditStage, SourceDetail } from "../observability/diagnostics.js";
import type { Config } from "../config/schema.js";
import { parseConfig } from "../config/schema.js";
import { audit, type AuditRecord } from "../observability/logger.js";
import { ask, type PermissionEvent, type Reviewer } from "../types.js";
import type { EvidenceSource } from "./project-review.js";
import { ReviewEngine } from "./review-engine.js";

export interface GateDependencies {
  options: unknown;
  reviewer: (config: Config) => Reviewer;
  command: (
    event: PermissionEvent,
  ) => string | undefined | { detailCode: SourceDetail };
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
          command = typeof captured === "string" ? captured : undefined;
          const resources = [...event.resources];
          result =
            command === undefined
              ? {
                  ...ask("missing_full_command"),
                  stage: "source",
                  detailCode:
                    typeof captured === "object"
                      ? captured.detailCode
                      : "capture_missing",
                }
              : await engine.review(
                  { command, resources, context: [] },
                  config.context.enabled
                    ? () => deps.context(event.sessionID, config)
                    : undefined,
                  event.sessionID,
                );
          if (result.decision === "allow") {
            errorStage = "recheck";
            const current = deps.command(event);
            const commandChanged = current !== command;
            const resourcesChanged =
              event.resources.length !== resources.length ||
              resources.some(
                (resource, index) => event.resources[index] !== resource,
              );
            if (commandChanged || resourcesChanged)
              result = {
                ...result,
                ...ask("input_changed"),
                stage: "recheck",
                detailCode: commandChanged
                  ? "source_input_changed"
                  : "scanner_resources_changed",
              };
          }
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
