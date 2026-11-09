import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test, spyOn } from "bun:test";
import type { Plugin } from "@opencode/plugin";
import plugin from "../../src/index.js";
import { createGate } from "../../src/core/permission-gate.js";
import type { PermissionEvent } from "../../src/types.js";
import { allowed, event, options } from "../fixtures/helpers.js";

// Single explicit boundary cast: runtime host is mocked, SDK itself is real.
function host(overrides: Record<string, unknown> = {}) {
  const hooks = new Map<string, (event: never) => void | Promise<void>>();
  let calls = 0;
  let contexts = 0;
  let disposed = 0;
  const prompts: string[] = [];
  const register = async (
    name: string,
    callback: (event: never) => void | Promise<void>,
  ) => {
    hooks.set(name, callback);
    return {
      async dispose() {
        disposed++;
        hooks.delete(name);
      },
    };
  };
  const ctx = {
    options,
    location: { directory: process.cwd() },
    permission: { hook: register },
    tool: { hook: register },
    experimental: {
      generate: {
        async text(input: { prompt: string; model: unknown }) {
          calls++;
          prompts.push(input.prompt);
          expect(input.model).toEqual(options.model);
          return { text: allowed };
        },
      },
    },
    session: {
      async context() {
        contexts++;
        return [{ type: "user", text: "Please inspect and test PRIVATE-DATA" }];
      },
    },
    ...overrides,
  } as unknown as Plugin.Context;
  async function emit(name: string, input: unknown) {
    const hook = hooks.get(name);
    if (!hook) throw new Error(`Missing hook ${name}`);
    await hook(input as never);
  }
  const before = (command: string, id = "c1", workdir?: string) =>
    emit("execute.before", {
      tool: "shell",
      sessionID: "s1",
      messageID: "m1",
      id,
      input: { command, ...(workdir ? { workdir } : {}) },
    });
  return {
    ctx,
    hooks,
    emit,
    before,
    prompts,
    stats: () => ({ calls, contexts, disposed }),
  };
}
test("entrypoint uses actual Plugin.define and registers/disposes native hooks", async () => {
  const mock = host();
  expect(plugin.id).toBe("opencode-censor");
  const cleanup = await plugin.setup(mock.ctx);
  expect(mock.hooks.size).toBe(3);
  await mock.before("pwd");
  const value = event();
  await mock.emit("evaluate", value);
  expect(value.effect).toBe("allow");
  expect(mock.stats().calls).toBe(1);
  expect(mock.stats().contexts).toBe(0);
  await cleanup?.();
  expect(mock.stats().disposed).toBe(3);
  expect(mock.hooks.size).toBe(0);
});
test("preserves non-shell and explicit deny; never calls the reviewer", async () => {
  const mock = host();
  const cleanup = await plugin.setup(mock.ctx);
  const read = { ...event(), action: "read", effect: "allow" };
  const denied = { ...event(), effect: "deny" };
  await mock.emit("evaluate", read);
  await mock.emit("evaluate", denied);
  expect(read.effect).toBe("allow");
  expect(denied.effect).toBe("deny");
  expect(mock.stats().calls).toBe(0);
  await cleanup?.();
});
test("dangerous, unknown, incomplete and split scanner resources ask even if initially allowed", async () => {
  const mock = host();
  const cleanup = await plugin.setup(mock.ctx);
  for (const command of [
    "rm -rf ./src",
    "pwd > /tmp/leak",
    "pwd && ls",
    "npm install",
  ]) {
    await mock.before(command);
    const value = {
      ...event(command.includes("pwd") ? ["pwd"] : [command]),
      effect: "allow",
    };
    await mock.emit("evaluate", value);
    expect(value.effect).toBe("ask");
  }
  await mock.before("pwd");
  const split = event(["pwd", "ls"]);
  await mock.emit("evaluate", split);
  expect(split.effect).toBe("ask");
  const unknown = {
    ...event(),
    source: { type: "tool", messageID: "unknown", id: "c1" },
  };
  await mock.emit("evaluate", unknown);
  expect(unknown.effect).toBe("ask");
  expect(mock.stats().calls).toBe(0);
  await cleanup?.();
});
test("source key isolates concurrent sessions and completion removes correlation", async () => {
  const mock = host();
  const cleanup = await plugin.setup(mock.ctx);
  await mock.before("pwd");
  const otherSession = { ...event(), sessionID: "s2" };
  await mock.emit("evaluate", otherSession);
  expect(otherSession.effect).toBe("ask");
  await mock.emit("execute.after", {
    sessionID: "s1",
    messageID: "m1",
    id: "c1",
  });
  const after = event();
  await mock.emit("evaluate", after);
  expect(after.effect).toBe("ask");
  await cleanup?.();
});
test("external workdir asks, later input edits are rechecked", async () => {
  const mock = host();
  const cleanup = await plugin.setup(mock.ctx);
  await mock.before("pwd", "c1", "../outside");
  const external = event();
  await mock.emit("evaluate", external);
  expect(external.effect).toBe("ask");
  const input = { command: "pwd" };
  await mock.emit("execute.before", {
    tool: "shell",
    sessionID: "s1",
    messageID: "m1",
    id: "c1",
    input,
  });
  input.command = "pwd; malicious";
  const changed = event();
  await mock.emit("evaluate", changed);
  expect(changed.effect).toBe("ask");
  await cleanup?.();
});
test("optional native context is bounded and transmits no raw prose", async () => {
  const mock = host({ options: { ...options, context: { enabled: true } } });
  const cleanup = await plugin.setup(mock.ctx);
  await mock.before("pwd");
  await mock.emit("evaluate", event());
  expect(mock.stats().contexts).toBe(1);
  expect(mock.prompts[0]).toContain('"context":["inspect","test"]');
  expect(mock.prompts[0]).not.toContain("PRIVATE-DATA");
  await cleanup?.();
});
test("invalid config asks; explicit disable delegates to native rules", async () => {
  for (const [configuration, expected] of [
    [{}, "ask"],
    [{ ...options, enabled: false }, "allow"],
  ] as const) {
    const mock = host({ options: configuration });
    const cleanup = await plugin.setup(mock.ctx);
    const value = { ...event(), effect: "allow" };
    await mock.emit("evaluate", value);
    expect(value.effect).toBe(expected);
    expect(mock.stats().calls).toBe(0);
    await cleanup?.();
  }
});
test("review failure changes allow to ask", async () => {
  const mock = host({
    experimental: {
      generate: {
        async text() {
          throw new Error("provider-secret");
        },
      },
    },
  });
  const cleanup = await plugin.setup(mock.ctx);
  await mock.before("pwd");
  const value = { ...event(), effect: "allow" };
  await mock.emit("evaluate", value);
  expect(value.effect).toBe("ask");
  expect(value.message).not.toContain("provider-secret");
  await cleanup?.();
});
test("gate catches unexpected command lookup errors", async () => {
  const gate = createGate({
    options,
    reviewer: () => ({
      async generate() {
        return allowed;
      },
    }),
    command: () => {
      throw new Error("secret");
    },
    context: async () => [],
  });
  const value = event();
  await gate.evaluate(value);
  expect(value.effect).toBe("ask");
  expect(value.message).toContain("gate error");
  gate.close();
});
test("native deny set during asynchronous review is preserved", async () => {
  let finish!: (text: string) => void;
  const gate = createGate({
    options,
    reviewer: () => ({
      generate: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    }),
    command: () => "pwd",
    context: async () => [],
  });
  const value: PermissionEvent = event();
  const pending = gate.evaluate(value);
  await Bun.sleep(1);
  value.effect = "deny";
  finish(allowed);
  await pending;
  expect(value.effect).toBe("deny");
  gate.close();
});
test("partial setup failure disposes earlier registrations", async () => {
  const mock = host({
    permission: {
      async hook() {
        throw new Error("registration failed");
      },
    },
  });
  await expect(plugin.setup(mock.ctx)).rejects.toThrow("registration failed");
  expect(mock.stats().disposed).toBe(2);
});
test("overlapping native evaluations do not exchange reviewer decisions", async () => {
  const mock = host({
    experimental: {
      generate: {
        async text({ prompt }: { prompt: string }) {
          if (prompt.includes('"command":"pwd"')) {
            await Bun.sleep(5);
            return { text: allowed };
          }
          return {
            text: '{"decision":"ask","riskLevel":"high","reason":"Uncertain repository configuration"}',
          };
        },
      },
    },
  });
  const cleanup = await plugin.setup(mock.ctx);
  await mock.before("pwd", "c1");
  await mock.before("git status", "c2");
  const first = event();
  const second = {
    ...event(["git status"]),
    source: { type: "tool", messageID: "m1", id: "c2" },
  };
  await Promise.all([
    mock.emit("evaluate", first),
    mock.emit("evaluate", second),
  ]);
  expect(first.effect).toBe("allow");
  expect(second.effect).toBe("ask");
  await cleanup?.();
});
test("unload settles a native in-flight allow as ask", async () => {
  let finish!: (value: { text: string }) => void;
  const mock = host({
    experimental: {
      generate: {
        text: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
    },
  });
  const cleanup = await plugin.setup(mock.ctx);
  await mock.before("pwd");
  const value = event();
  const pending = mock.emit("evaluate", value);
  await Bun.sleep(1);
  await cleanup?.();
  await pending;
  expect(value.effect).toBe("ask");
  finish({ text: allowed });
  await Bun.sleep(1);
  expect(value.effect).toBe("ask");
});
test("source mutation while model review is pending cannot reuse an allow", async () => {
  let finish!: (value: { text: string }) => void;
  const mock = host({
    experimental: {
      generate: {
        text: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
    },
  });
  const cleanup = await plugin.setup(mock.ctx);
  const input = { command: "pwd" };
  await mock.emit("execute.before", {
    tool: "shell",
    sessionID: "s1",
    messageID: "m1",
    id: "c1",
    input,
  });
  const value = event();
  const pending = mock.emit("evaluate", value);
  await Bun.sleep(1);
  input.command = "pwd; unsafe";
  finish({ text: allowed });
  await pending;
  expect(value.effect).toBe("ask");
  expect(value.message).toContain("input changed");
  await cleanup?.();
});

test("stateful adapter correlates source, supports subdirectories, and rechecks pending edits", async () => {
  const root = await mkdtemp(join(tmpdir(), "censor-stateful-host-"));
  let finish: (() => void) | undefined;
  let started: (() => void) | undefined;
  let delay = false;
  const mock = host({
    location: { directory: root },
    options: {
      ...options,
      review: {
        strategy: "stateful",
        project: {
          allowFileContents: true,
          allowedPaths: ["."],
        },
      },
    },
    experimental: {
      generate: {
        async text({ prompt }: { prompt: string }) {
          expect(prompt).toContain('"path":"Makefile"');
          if (!prompt.includes('"content":'))
            return {
              text: JSON.stringify({ action: "read", path: "Makefile" }),
            };
          if (delay) {
            started?.();
            await new Promise<void>((resolve) => {
              finish = resolve;
            });
          }
          return {
            text: JSON.stringify({
              decision: "allow",
              riskLevel: "low",
              action: "decide",
              reasonCode: "understood_operation",
              uncertain: false,
              evidence: ["e2"],
              effects: ["workspace_read"],
              confidence: 0.99,
            }),
          };
        },
      },
    },
  });
  let cleanup: Awaited<ReturnType<typeof plugin.setup>> = undefined;
  try {
    await writeFile(
      join(root, "Makefile"),
      ".PHONY: Makefile GNUmakefile makefile check\ncheck:\n\tpwd\n",
    );
    await mkdir(join(root, "subdir"));
    cleanup = await plugin.setup(mock.ctx);
    await mock.before("make check");
    const value = event(["make check"]);
    await mock.emit("evaluate", value);
    expect(value.effect).toBe("allow");
    await mock.before("make check", "c1", "subdir");
    const subdir = event(["make check"]);
    await mock.emit("evaluate", subdir);
    expect(subdir.effect).toBe("allow");
    const input = { command: "make check", workdir: "." };
    await mock.emit("execute.before", {
      tool: "shell",
      sessionID: "s1",
      messageID: "m1",
      id: "c1",
      input,
    });
    delay = true;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const changed = event(["make check"]);
    const pending = mock.emit("evaluate", changed);
    await ready;
    input.workdir = "subdir";
    finish?.();
    await pending;
    expect(changed.effect).toBe("ask");
    expect(changed.message).toContain("input changed");
    await mock.before("make check");
    const denied: PermissionEvent = {
      ...event(["make check"]),
      effect: "deny",
    };
    await mock.emit("evaluate", denied);
    expect(denied.effect).toBe("deny");
  } finally {
    await cleanup?.();
    await rm(root, { recursive: true, force: true });
  }
});

test("native source failures produce distinct audit diagnostics without changing asks", async () => {
  const root = await mkdtemp(join(tmpdir(), "censor-source-audit-"));
  const file = join(root, "audit.jsonl");
  const mock = host({
    options: { ...options, logging: { enabled: true, file } },
  });
  const cleanup = await plugin.setup(mock.ctx);
  try {
    await mock.emit("evaluate", { ...event(), source: undefined });
    await mock.emit("evaluate", event());
    await mock.before("ls", "c1", "/outside");
    await mock.emit("evaluate", event(["ls"]));
    await mock.emit("execute.before", {
      tool: "shell",
      sessionID: "s1",
      messageID: "m1",
      id: "c1",
      input: { command: "ls", workdir: 42 },
    });
    await mock.emit("evaluate", event(["ls"]));
    await mock.emit("execute.before", {
      tool: "shell",
      sessionID: "s1",
      messageID: "m1",
      id: "c1",
      input: { command: 42 },
    });
    await mock.emit("evaluate", event(["ls"]));
    await mock.before("ls");
    const now = Date.now();
    const clock = spyOn(Date, "now").mockReturnValue(now + 60001);
    try {
      await mock.emit("evaluate", event(["ls"]));
    } finally {
      clock.mockRestore();
    }
    const records = (await readFile(file, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(records.map((record) => record.detailCode)).toEqual([
      "missing_source_identifiers",
      "capture_missing",
      "external_workdir",
      "invalid_workdir",
      "invalid_command",
      "capture_expired",
    ]);
    for (const record of records)
      expect(record).toMatchObject({
        reason: "missing_full_command",
        decision: "ask",
        reviewCalls: 0,
        stage: "source",
        sessionID: "s1",
        schemaVersion: 2,
      });
    expect(mock.stats().calls).toBe(0);
  } finally {
    await cleanup?.();
    await rm(root, { recursive: true, force: true });
  }
});
