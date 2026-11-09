import { defaultAuditPath } from "../observability/path.js";
import type { Mode } from "../types.js";

export interface Config {
  enabled: boolean;
  model: { providerID: string; id: string };
  mode: Mode;
  fallback: "ask";
  systemPrompt: string;
  review: {
    strategy: "stateless" | "stateful";
    maxModelCalls: number;
    allowShellSyntax: boolean;
    alwaysAsk: string[];
    forbiddenEffects: string[];
    project: {
      allowFileContents: boolean;
      allowedPaths: string[];
      excludedPaths: string[];
      maxFileBytes: number;
      maxTotalBytes: number;
      maxFiles: number;
      maxDirectoryEntries: number;
    };
  };
  timeoutMs: number;
  context: { enabled: boolean; maxMessages: number; maxCharacters: number };
  logging: {
    enabled: boolean;
    level: "info" | "error";
    includeCommands: boolean;
    file: string;
  };
  cache: { enabled: false };
}
export function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error("Invalid configuration");
}
function section(value: unknown, allowed: string[]): Record<string, unknown> {
  if (value === undefined) return {};
  if (!object(value)) throw new Error("Invalid configuration");
  keys(value, allowed);
  return value;
}
function bool(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error("Invalid configuration");
  return value;
}
function integer(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error("Invalid configuration");
  return value;
}
function identifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(value) ||
    value === "MODEL_ID"
  )
    throw new Error("Invalid model");
  return value;
}
export function parseConfig(value: unknown): Config {
  const root = section(value, [
    "enabled",
    "model",
    "mode",
    "fallback",
    "systemPrompt",
    "review",
    "timeoutMs",
    "context",
    "logging",
    "cache",
  ]);
  const review = section(root.review, [
    "strategy",
    "project",
    "maxModelCalls",
    "allowShellSyntax",
    "alwaysAsk",
    "forbiddenEffects",
  ]);
  const project = section(review.project, [
    "allowFileContents",
    "allowedPaths",
    "excludedPaths",
    "maxFileBytes",
    "maxTotalBytes",
    "maxFiles",
    "maxDirectoryEntries",
  ]);
  const strategy =
    review.strategy === undefined ? "stateless" : review.strategy;
  if (strategy !== "stateless" && strategy !== "stateful")
    throw new Error("Invalid strategy");
  const allowFileContents = bool(project.allowFileContents, false);
  if (strategy === "stateful" && !allowFileContents)
    throw new Error("Project disclosure requires opt-in");
  const list = (value: unknown, defaults: string[]): string[] => {
    if (value === undefined) return defaults;
    if (
      !Array.isArray(value) ||
      value.length > 32 ||
      value.some(
        (v) =>
          typeof v !== "string" ||
          !v ||
          v.length > 300 ||
          /[\u0000-\u001f\u007f]/.test(v),
      )
    )
      throw new Error("Invalid project list");
    return [...new Set(value as string[])];
  };
  const paths = (value: unknown, defaults: string[]): string[] => {
    const result = list(value, defaults);
    if (
      result.some(
        (path) =>
          path !== "." &&
          (!/^[a-zA-Z0-9_. /-]+$/.test(path) ||
            path.startsWith("/") ||
            path
              .split("/")
              .some((part) => !part || part === "." || part === "..")),
      )
    )
      throw new Error("Invalid project path");
    return result;
  };
  const forbiddenEffects = list(review.forbiddenEffects, [
    "network",
    "privilege",
    "destructive",
    "outside_project",
    "unknown",
  ]);
  if (
    forbiddenEffects.some(
      (effect) =>
        ![
          "workspace_read",
          "workspace_write",
          "process_execution",
          "network",
          "privilege",
          "destructive",
          "outside_project",
          "unknown",
        ].includes(effect),
    )
  )
    throw new Error("Invalid effect");
  const model = section(root.model, ["providerID", "id"]);
  const context = section(root.context, [
    "enabled",
    "maxMessages",
    "maxCharacters",
  ]);
  const logging = section(root.logging, [
    "enabled",
    "level",
    "includeCommands",
    "file",
  ]);
  const cache = section(root.cache, ["enabled"]);
  const systemPrompt = root.systemPrompt === undefined ? "" : root.systemPrompt;
  if (
    typeof systemPrompt !== "string" ||
    systemPrompt.length > 6000 ||
    systemPrompt.includes("\0")
  )
    throw new Error("Invalid system prompt");
  const mode = root.mode ?? "balanced";
  if (mode !== "strict" && mode !== "balanced" && mode !== "permissive")
    throw new Error("Invalid mode");
  if (root.fallback !== undefined && root.fallback !== "ask")
    throw new Error("Unsafe fallback");
  if (bool(cache.enabled, false))
    throw new Error("Unsupported sensitive option");
  const level = logging.level ?? "info";
  if (level !== "info" && level !== "error")
    throw new Error("Invalid log level");
  if (
    logging.file !== undefined &&
    (typeof logging.file !== "string" ||
      !logging.file.startsWith("/") ||
      logging.file.includes("\0"))
  )
    throw new Error("Invalid audit file");
  return {
    enabled: bool(root.enabled, true),
    model: {
      providerID: identifier(model.providerID),
      id: identifier(model.id),
    },
    mode,
    fallback: "ask",
    systemPrompt,
    review: {
      strategy,
      maxModelCalls: integer(review.maxModelCalls, 4, 1, 8),
      allowShellSyntax: bool(review.allowShellSyntax, false),
      alwaysAsk: list(review.alwaysAsk, []),
      forbiddenEffects,
      project: {
        allowFileContents,
        allowedPaths: paths(project.allowedPaths, ["."]),
        excludedPaths: paths(project.excludedPaths, []),
        maxFileBytes: integer(project.maxFileBytes, 16384, 1, 65536),
        maxTotalBytes: integer(project.maxTotalBytes, 65536, 1, 262144),
        maxFiles: integer(project.maxFiles, 16, 1, 32),
        maxDirectoryEntries: integer(project.maxDirectoryEntries, 128, 1, 512),
      },
    },
    timeoutMs: integer(root.timeoutMs, 15000, 10, 60000),
    context: {
      enabled: bool(context.enabled, false),
      maxMessages: integer(context.maxMessages, 5, 1, 20),
      maxCharacters: integer(context.maxCharacters, 6000, 1, 12000),
    },
    logging: {
      enabled: bool(logging.enabled, true),
      level,
      includeCommands: bool(logging.includeCommands, true),
      file: (logging.file as string | undefined) ?? defaultAuditPath(),
    },
    cache: { enabled: false },
  };
}
