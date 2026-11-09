import { expect, test } from "bun:test";
import { createGate } from "../../src/core/permission-gate.js";
import type { AuditRecord } from "../../src/observability/logger.js";
import { allowed, event, options } from "../fixtures/helpers.js";

test.each([true, false])(
  "audit source preserves exact command when enabled=%s",
  async (includeCommands) => {
    const records: AuditRecord[] = [];
    // Inert string only: unsupported syntax is reviewed locally and never executed.
    const command = 'echo "private value"\n  git status  ';
    const gate = createGate({
      options: { ...options, logging: { enabled: true, includeCommands } },
      reviewer: () => ({ generate: async () => allowed }),
      command: () => command,
      context: async () => [],
      log: (record) => records.push(JSON.parse(JSON.stringify(record))),
    });
    const value = event([command]);
    await gate.evaluate(value);
    expect(value.effect).toBe("ask");
    expect(records[0]?.sessionID).toBe(value.sessionID);
    expect(records[0]?.command).toBe(includeCommands ? command : undefined);
    expect(records[0]?.reason).toBe("policy_requires_review");
    gate.close();
  },
);

test("missing full source logs session without inventing a command", async () => {
  const records: AuditRecord[] = [];
  const gate = createGate({
    options: { ...options, logging: { enabled: true } },
    reviewer: () => ({ generate: async () => allowed }),
    command: () => undefined,
    context: async () => [],
    log: (record) => records.push(record),
  });
  await gate.evaluate(event(["scanner fragment"]));
  expect(records[0]?.sessionID).toBe("s1");
  expect(records[0]).not.toHaveProperty("command");
  expect(records[0]?.reason).toBe("missing_full_command");
  gate.close();
});
