#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { defaultAuditPath } from "./observability/path.js";

type Counts = { total: number; allow: number; ask: number };
export function countAudit(text: string): Counts {
  const counts: Counts = { total: 0, allow: 0, ask: 0 };
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error("Audit file contains an invalid JSON line");
    }
    if (
      typeof value !== "object" ||
      value === null ||
      !("action" in value) ||
      value.action !== "shell" ||
      !("decision" in value) ||
      (value.decision !== "allow" && value.decision !== "ask")
    )
      throw new Error("Audit file contains an invalid decision record");
    counts.total++;
    counts[value.decision]++;
  }
  return counts;
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  const path = process.argv[2] ?? defaultAuditPath();
  if (process.argv.length > 3 || path === "--help") {
    console.log("Usage: censor-stats [audit.jsonl]");
    process.exit(path === "--help" ? 0 : 2);
  }
  try {
    const { total, allow, ask } = countAudit(readFileSync(path, "utf8"));
    console.log(`Audit file: ${path}`);
    console.log(
      `Automatic approvals: ${allow} / ${total} (${total ? ((allow / total) * 100).toFixed(1) : "0.0"}%)`,
    );
    console.log(`Sent to native approval: ${ask} / ${total}`);
    console.log(
      "Scope: shell evaluations audited by this plugin; native denies and later human decisions are excluded.",
    );
  } catch (error) {
    console.error(
      error instanceof Error && error.message.startsWith("Audit file")
        ? error.message
        : `Cannot read audit file: ${path}`,
    );
    process.exitCode = 1;
  }
}
