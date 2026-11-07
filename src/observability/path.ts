import { homedir } from "node:os";
import { join } from "node:path";

export function defaultAuditPath(): string {
  return join(
    process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"),
    "opencode-censor",
    "audit.jsonl",
  );
}
