import { afterEach, expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  writeFile,
  rename,
  symlink,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseConfig, type Config } from "../../src/config/schema.js";
import { ReviewEngine } from "../../src/core/review-engine.js";
import { createGate } from "../../src/core/permission-gate.js";
import {
  ProjectEvidence,
  type EvidenceSource,
  type EvidenceResult,
} from "../../src/core/project-review.js";
import { inspectWorkdir } from "../../src/core/workdir.js";
import type {
  Outcome,
  SourceSnapshot,
  PermissionEvent,
} from "../../src/types.js";
import { allowed, event, options } from "../fixtures/helpers.js";

const roots: string[] = [];
const engines: ReviewEngine[] = [];
afterEach(async () => {
  for (const engine of engines.splice(0)) engine.close();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
const input = (command = "ninja", workdir = ".") => ({
  command,
  resources: [command],
  context: [],
  workdir,
});
const data = (prompt: string) => JSON.parse(prompt.split("\nDATA\n")[1]!);
const final = JSON.stringify({
  action: "decide",
  decision: "allow",
  riskLevel: "low",
  reasonCode: "understood_operation",
  confidence: 0.99,
  uncertain: false,
  evidence: ["e2"],
  effects: ["workspace_read", "process_execution"],
});
function config(
  review: Record<string, unknown> = {},
  timeoutMs = 1000,
): Config {
  return parseConfig({
    ...options,
    timeoutMs,
    review: {
      strategy: "hybrid",
      project: { allowFileContents: true },
      ...review,
    },
  });
}
async function root() {
  const path = await mkdtemp(join(tmpdir(), "censor-workflow-"));
  roots.push(path);
  await mkdir(join(path, "packages/app"), { recursive: true });
  await writeFile(join(path, "packages/app/build.ninja"), "# inert evidence\n");
  return path;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
async function setup(patch: Record<string, unknown> = {}, timeoutMs = 1000) {
  const directory = await root();
  const settings = config(patch, timeoutMs);
  const prompts: string[] = [];
  const blockers = new Map<string, ReturnType<typeof deferred<string>>>();
  const engine = new ReviewEngine(
    settings,
    {
      async generate(prompt) {
        prompts.push(prompt);
        const value = data(prompt);
        const block = blockers.get(value.command);
        if (block) {
          blockers.delete(value.command);
          return block.promise;
        }
        if (!value.evidence) return allowed;
        return value.evidence.length === 1
          ? JSON.stringify({ action: "read", path: "packages/app/build.ninja" })
          : final;
      },
    },
    new ProjectEvidence(directory, settings.review.project),
  );
  engines.push(engine);
  return { directory, engine, prompts, blockers, settings };
}
async function until(check: () => boolean) {
  for (let i = 0; i < 1000; i++) {
    if (check()) return;
    await Bun.sleep(1);
  }
  throw new Error("Test did not reach expected state");
}

test("hybrid needs file disclosure consent and keeps the stateless default", () => {
  expect(parseConfig(options).review.strategy).toBe("stateless");
  expect(() =>
    parseConfig({ ...options, review: { strategy: "hybrid" } }),
  ).toThrow();
  expect(() => config({ project: { allowFileContents: false } })).toThrow();
});

test.each([
  "ls",
  "ls -lah",
  "git status",
  "git status --short",
  "git status --porcelain",
])(
  "hybrid inspection %s needs a model but zero evidence reads",
  async (command) => {
    const f = await setup();
    const outcome = await f.engine.review(input(command), undefined, "s");
    expect(outcome).toMatchObject({
      decision: "allow",
      reviewPath: "inspection",
      reviewCalls: 1,
      queueWaitMs: 0,
    });
    expect(f.prompts).toHaveLength(1);
    expect(data(f.prompts[0]!).evidence).toBeUndefined();
  },
);

test("hybrid commands use project review with consented evidence and actual workdir", async () => {
  const f = await setup();
  const outcome = await f.engine.review(
    input("ninja", "packages/app"),
    undefined,
    "s",
  );
  expect(outcome).toMatchObject({
    decision: "allow",
    reviewPath: "project",
    reviewCalls: 2,
  });
  expect(data(f.prompts[0]!).workdir).toBe("packages/app");
  expect(data(f.prompts[1]!).evidence[1].request.path).toBe(
    "packages/app/build.ninja",
  );
});

test.each(["workspace_read", "process_execution"])(
  "hybrid inspection conservatively honors forbidden %s without routing retries",
  async (effect) => {
    const f = await setup({ forbiddenEffects: [effect] });
    expect(await f.engine.review(input("pwd"), undefined, "s")).toMatchObject({
      decision: "ask",
      detailCode: "inspection_forbidden_effect",
    });
    expect(f.prompts).toHaveLength(0);
  },
);

test("alwaysAsk applies before both hybrid routes; failed inspections never retry project review", async () => {
  const f = await setup({ alwaysAsk: ["ls", "ninja"] });
  for (const command of ["ls", "ninja"])
    expect(
      (await f.engine.review(input(command), undefined, "s")).detailCode,
    ).toBe("always_ask_match");
  expect(f.prompts).toHaveLength(0);
  for (const reply of [
    '{"decision":"ask","riskLevel":"low","reason":"Uncertain."}',
    "invalid",
    "reject",
    "hang",
  ]) {
    let calls = 0;
    const engine = new ReviewEngine(
      config({}, 15),
      {
        generate() {
          calls++;
          if (reply === "reject") return Promise.reject(new Error("private"));
          if (reply === "hang") return new Promise(() => {});
          return Promise.resolve(reply);
        },
      },
      new ProjectEvidence(f.directory, f.settings.review.project),
    );
    engines.push(engine);
    expect((await engine.review(input("ls"), undefined, "s")).decision).toBe(
      "ask",
    );
    expect(calls).toBe(1);
  }
});

test("hybrid mismatched resources use evidence review, never stateless approval", async () => {
  const f = await setup();
  const result = await f.engine.review(
    { ...input("ls"), resources: ["ls *"] },
    undefined,
    "s",
  );
  expect(result.reviewPath).toBe("project");
  expect(data(f.prompts[0]!).evidence).toHaveLength(1);
  expect(
    (await f.engine.review({ ...input(), resources: [] }, undefined, "s"))
      .decision,
  ).toBe("ask");
});

test("canonical workdir containment rejects external, invalid and symlinked paths", async () => {
  const directory = await root();
  const outside = await root();
  const signal = new AbortController().signal;
  await symlink(outside, join(directory, "escape"));
  await symlink(join(directory, "packages"), join(directory, "internal-link"));
  for (const path of [
    outside,
    "../outside",
    "missing",
    "packages/app/build.ninja",
    "escape",
    "internal-link/app",
    "bad\0path",
  ])
    await expect(inspectWorkdir(directory, path, signal)).rejects.toThrow();
  expect(
    (await inspectWorkdir(directory, "packages/app", signal)).workdir,
  ).toBe("packages/app");
  const linked = join(outside, "project-link");
  await symlink(directory, linked);
  expect((await inspectWorkdir(linked, "packages/app", signal)).root).toBe(
    directory,
  );
  expect(
    (await inspectWorkdir(linked, join(directory, "packages/app"), signal))
      .workdir,
  ).toBe("packages/app");
});

test.each(["stateless", "stateful", "hybrid"] as const)(
  "%s rejects native home-relative workdirs despite literal project directories",
  async (strategy) => {
    const directory = await root();
    await mkdir(join(directory, "~/app"), { recursive: true });
    const signal = new AbortController().signal;
    for (const workdir of ["~", "~/app"]) {
      await expect(
        inspectWorkdir(directory, workdir, signal),
      ).rejects.toMatchObject({ code: "invalid_workdir" });
      let calls = 0;
      let evidenceSessions = 0;
      const settings = config({ strategy });
      const command = strategy === "stateless" ? "ls" : "ninja";
      const gate = createGate({
        options: settings,
        directory,
        command: () => ({ command, workdir }),
        context: async () => [],
        reviewer: () => ({
          async generate() {
            calls++;
            return allowed;
          },
        }),
        project: () => ({
          create() {
            evidenceSessions++;
            throw new Error("must not acquire evidence");
          },
        }),
      });
      try {
        const value: PermissionEvent = { ...event([command]), effect: "allow" };
        await gate.evaluate(value);
        expect(value.effect).toBe("ask");
        expect(value.message).toContain("missing full command");
        expect(calls).toBe(0);
        expect(evidenceSessions).toBe(0);
      } finally {
        gate.close();
      }
    }
    // An explicitly relative literal directory is not home expansion in 2.2.5.
    expect((await inspectWorkdir(directory, "./~/app", signal)).path).toBe(
      join(directory, "~/app"),
    );
  },
);

test("directory replacement, raw workdir mutation and resource mutation invalidate pending allows", async () => {
  for (const mutation of ["directory", "field", "resources", "home"]) {
    const directory = await root();
    const settings = config();
    const entered = deferred<void>();
    const finish = deferred<string>();
    let snapshot: SourceSnapshot = { command: "ls", workdir: "packages/app" };
    const resources = ["ls"];
    const gate = createGate({
      options: settings,
      directory,
      command: () => snapshot,
      context: async () => [],
      reviewer: () => ({
        generate() {
          entered.resolve();
          return finish.promise;
        },
      }),
    });
    const value = event(resources);
    const pending = gate.evaluate(value);
    await entered.promise;
    if (mutation === "directory") {
      await rename(
        join(directory, "packages/app"),
        join(directory, "packages/old"),
      );
      await mkdir(join(directory, "packages/app"));
    }
    if (mutation === "field") snapshot = { command: "ls", workdir: "packages" };
    if (mutation === "resources") resources[0] = "ls *";
    if (mutation === "home") snapshot = { command: "ls", workdir: "~/app" };
    finish.resolve(allowed);
    await pending;
    expect(value.effect).toBe("ask");
    expect(value.message).toContain("input changed");
    gate.close();
  }
});

test("findings and discovery hints never cross working directories", async () => {
  const f = await setup();
  await f.engine.review(input("ninja", "packages/app"), undefined, "s");
  await f.engine.review(input("ninja", "."), undefined, "s");
  expect(data(f.prompts[2]!).previousFiles).toEqual([]);
  expect(data(f.prompts[3]!).verifiedFindings).toEqual([]);
  await f.engine.review(input("ninja", "packages/app"), undefined, "s");
  expect(data(f.prompts[5]!).verifiedFindings).toHaveLength(1);
});

test("same-session reviews wait FIFO while another session progresses", async () => {
  const f = await setup();
  const block = deferred<string>();
  f.blockers.set("ninja first", block);
  const first = f.engine.review(input("ninja first"), undefined, "s");
  await until(() => f.prompts.length === 1);
  const second = f.engine.review(input("ninja second"), undefined, "s");
  const third = f.engine.review(input("ninja third"), undefined, "s");
  expect(
    (await f.engine.review(input("ninja other"), undefined, "other")).decision,
  ).toBe("allow");
  expect(
    f.prompts.some((prompt) => data(prompt).command === "ninja second"),
  ).toBe(false);
  block.resolve(
    JSON.stringify({ action: "read", path: "packages/app/build.ninja" }),
  );
  const results = await Promise.all([first, second, third]);
  expect(results.every((outcome) => outcome.decision === "allow")).toBe(true);
  const order = f.prompts.map((prompt) => data(prompt).command);
  expect(order.indexOf("ninja second")).toBeLessThan(
    order.indexOf("ninja third"),
  );
  expect(results[1]!.queueWaitMs).toBeGreaterThan(0);
});

test("hung timed-out work retains its session lock; expired waiters never generate", async () => {
  const f = await setup({}, 25);
  const block = deferred<string>();
  f.blockers.set("ninja hung", block);
  const first = f.engine.review(input("ninja hung"), undefined, "s");
  await until(() => f.prompts.length === 1);
  const second = f.engine.review(input("ninja expired"), undefined, "s");
  expect((await first).code).toBe("timeout");
  expect(await second).toMatchObject({
    code: "timeout",
    reviewCalls: 0,
    stage: "admission",
  });
  expect(
    (await f.engine.review(input("ninja still locked"), undefined, "s"))
      .reviewCalls,
  ).toBe(0);
  block.reject(new Error("PRIVATE late failure"));
  await Bun.sleep(2);
  expect(
    (await f.engine.review(input("ninja recovered"), undefined, "s")).decision,
  ).toBe("allow");
  expect(
    f.prompts.some((prompt) => data(prompt).command.includes("expired")),
  ).toBe(false);
});

test("global queue and per-session queue have fixed independent bounds; unload clears waiters", async () => {
  const f = await setup();
  const running: Promise<Outcome>[] = [];
  const blocks: ReturnType<typeof deferred<string>>[] = [];
  for (let i = 0; i < 8; i++) {
    const block = deferred<string>();
    blocks.push(block);
    f.blockers.set(`ninja ${i}`, block);
    running.push(f.engine.review(input(`ninja ${i}`), undefined, `s${i}`));
  }
  await until(() => f.prompts.length === 8);
  const waiting = Array.from({ length: 8 }, (_, i) =>
    f.engine.review(input(`queued ${i}`), undefined, "s0"),
  );
  expect((await f.engine.review(input(), undefined, "s0")).code).toBe(
    "session_queue_full",
  );
  for (let i = 0; i < 24; i++)
    waiting.push(f.engine.review(input(), undefined, `other${i}`));
  expect((await f.engine.review(input(), undefined, "overflow")).code).toBe(
    "review_queue_full",
  );
  f.engine.close();
  expect(
    (await Promise.all([...running, ...waiting])).every(
      (outcome) => outcome.code === "unloaded",
    ),
  ).toBe(true);
  expect(f.prompts).toHaveLength(8);
  for (const block of blocks) block.resolve(final);
  await Bun.sleep(1);
});

test("queued native source mutations are rejected before context, evidence or generation", async () => {
  const directory = await root();
  const settings = config({ strategy: "stateful" });
  const entered = deferred<void>();
  const finish = deferred<string>();
  let calls = 0;
  let evidenceCalls = 0;
  const real = new ProjectEvidence(directory, settings.review.project);
  const source: EvidenceSource = {
    create(signal) {
      evidenceCalls++;
      return real.create(signal);
    },
  };
  const snapshots = new Map<string, SourceSnapshot>([
    ["c1", { command: "ninja first" }],
    ["c2", { command: "ninja queued" }],
  ]);
  const gate = createGate({
    options: settings,
    directory,
    project: () => source,
    command: (value) => snapshots.get(value.source!.id),
    context: async () => [],
    reviewer: () => ({
      generate() {
        calls++;
        entered.resolve();
        return finish.promise;
      },
    }),
  });
  const first = event(["ninja first"]);
  const second = {
    ...event(["ninja queued"]),
    source: { type: "tool" as const, messageID: "m1", id: "c2" },
  };
  const active = gate.evaluate(first);
  await entered.promise;
  const queued = gate.evaluate(second);
  snapshots.set("c2", { command: "ninja changed", workdir: "packages/app" });
  finish.resolve(
    '{"action":"decide","decision":"ask","riskLevel":"low","reasonCode":"incomplete_evidence","confidence":0.99,"uncertain":true,"evidence":["e1"],"effects":["unknown"]}',
  );
  await Promise.all([active, queued]);
  expect(second.effect).toBe("ask");
  expect(second.message).toContain("input changed");
  expect(calls).toBe(1);
  expect(evidenceCalls).toBe(1);
  gate.close();
});

test("total deadline starts at entry and includes source preparation and final recheck", async () => {
  let calls = 0;
  const engine = new ReviewEngine(config({}, 15), {
    async generate() {
      calls++;
      return allowed;
    },
  });
  engines.push(engine);
  expect(
    (
      await engine.review(input("ls"), undefined, "s", {
        started: performance.now() - 100,
      })
    ).code,
  ).toBe("timeout");
  expect(calls).toBe(0);
  const preparation = deferred<ReturnType<typeof input>>();
  expect(
    (
      await engine.review(input("ls"), undefined, "s", {
        prepare: () => preparation.promise,
      })
    ).code,
  ).toBe("timeout");
  expect(calls).toBe(0);
  preparation.resolve(input("ls"));
  const recheck = deferred<undefined>();
  expect(
    (
      await engine.review(input("ls"), undefined, "s", {
        recheck: () => recheck.promise,
      })
    ).code,
  ).toBe("timeout");
  expect(calls).toBe(1);
  recheck.reject(new Error("late private recheck error"));
  await Bun.sleep(1);
});

test("hung evidence retains active capacity and session lock until late settlement", async () => {
  const stalled = deferred<EvidenceResult>();
  const started = deferred<void>();
  let operations = 0;
  let modelCalls = 0;
  const engine = new ReviewEngine(
    config({ strategy: "stateful" }, 20),
    {
      async generate() {
        modelCalls++;
        return final;
      },
    },
    {
      create() {
        return {
          request() {
            operations++;
            started.resolve();
            return stalled.promise;
          },
          async unchanged() {
            return true;
          },
          stamps() {
            return [];
          },
        };
      },
    },
  );
  engines.push(engine);
  const first = engine.review(input(), undefined, "s");
  await started.promise;
  expect((await first).code).toBe("timeout");
  expect((await engine.review(input(), undefined, "s")).reviewCalls).toBe(0);
  expect(operations).toBe(1);
  stalled.reject(new Error("late evidence failure"));
  await Bun.sleep(1);
  expect((await engine.review(input(), undefined, "s")).code).toBe(
    "review_error",
  );
  expect(operations).toBe(2);
  expect(modelCalls).toBe(0);
});

test.each(["missing", "workdir", "resources", "identifiers"])(
  "queued %s mutation skips all generation for that request",
  async (mutation) => {
    const f = await setup({ strategy: "stateful" });
    let snapshot: SourceSnapshot | undefined = {
      command: "ninja second",
      workdir: ".",
    };
    const value = event(["ninja second"]);
    const entered = deferred<void>();
    const finish = deferred<string>();
    let calls = 0;
    const shared = createGate({
      options: f.settings,
      directory: f.directory,
      project: () =>
        new ProjectEvidence(f.directory, f.settings.review.project),
      command: () => snapshot,
      context: async () => [],
      reviewer: () => ({
        generate() {
          calls++;
          entered.resolve();
          return finish.promise;
        },
      }),
    });
    const active = shared.evaluate(event(["ninja second"]));
    await entered.promise;
    const queued = shared.evaluate(value);
    if (mutation === "missing") snapshot = undefined;
    if (mutation === "workdir")
      snapshot = { command: "ninja second", workdir: "packages/app" };
    if (mutation === "resources") (value.resources as string[]).push("ls");
    if (mutation === "identifiers")
      Object.assign(value, {
        source: { type: "tool", messageID: "other", id: "other" },
      });
    finish.resolve(
      '{"action":"decide","decision":"ask","riskLevel":"low","reasonCode":"incomplete_evidence","confidence":0.99,"uncertain":true,"evidence":["e1"],"effects":["unknown"]}',
    );
    await Promise.all([active, queued]);
    expect(value.effect).toBe("ask");
    expect(value.message).toContain("input changed");
    expect(calls).toBe(1);
    shared.close();
  },
);
