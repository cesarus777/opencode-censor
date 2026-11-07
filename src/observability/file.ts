import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AuditRecord } from "./logger.js";

export function fileAuditSink(path: string): (record: AuditRecord) => void {
  let ready = false;
  return (record) => {
    if (!ready) {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      ready = true;
    }
    appendFileSync(path, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  };
}
