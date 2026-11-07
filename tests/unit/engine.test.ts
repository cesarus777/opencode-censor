import { expect, test } from "bun:test";
import { ReviewEngine } from "../../src/core/review-engine.js";
import { audit } from "../../src/observability/logger.js";
import { ask } from "../../src/types.js";
import { allowed, config } from "../fixtures/helpers.js";

const input = { command: "pwd", resources: ["pwd"], context: [] };
test("successful review includes isolated data and returns allow", async () => {
  const engine = new ReviewEngine(config(), {
    async generate(prompt) {
      expect(prompt).toContain('DATA\n{"command":"pwd"');
      return allowed;
    },
  });
  expect((await engine.review(input)).decision).toBe("allow");
});
test.each(["network error", "rate limit", "missing model"])(
  "provider error falls back: %s",
  async (message) => {
    const engine = new ReviewEngine(config(), {
      async generate() {
        throw new Error(message);
      },
    });
    expect((await engine.review(input)).code).toBe("review_error");
  },
);
test("invalid result and context failure ask", async () => {
  const engine = new ReviewEngine(config(), {
    async generate() {
      return "ALLOW";
    },
  });
  expect((await engine.review(input)).decision).toBe("ask");
  expect(
    (
      await engine.review(input, async () => {
        throw new Error("context");
      })
    ).decision,
  ).toBe("ask");
});
test("timeout aborts and late allow never changes the result", async () => {
  let finish!: (text: string) => void;
  let signal: AbortSignal | undefined;
  const engine = new ReviewEngine(
    { ...config(), timeoutMs: 10 },
    {
      generate(_prompt, abort) {
        signal = abort;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  );
  const result = await engine.review(input);
  expect(result.code).toBe("timeout");
  expect(signal?.aborted).toBe(true);
  finish(allowed);
  await Bun.sleep(1);
  expect(result.decision).toBe("ask");
});
test("late rejected promise is handled", async () => {
  let reject!: (error: Error) => void;
  const engine = new ReviewEngine(
    { ...config(), timeoutMs: 10 },
    {
      generate() {
        return new Promise((_resolve, fail) => {
          reject = fail;
        });
      },
    },
  );
  expect((await engine.review(input)).code).toBe("timeout");
  reject(new Error("late secret provider error"));
  await Bun.sleep(1);
});
test("bounded concurrency counts non-cancellable expired requests", async () => {
  const engine = new ReviewEngine(
    { ...config(), timeoutMs: 10 },
    {
      generate() {
        return new Promise(() => {});
      },
    },
  );
  const results = await Promise.all(
    Array.from({ length: 10 }, () => engine.review(input)),
  );
  expect(results.filter((r) => r.code === "review_capacity")).toHaveLength(2);
  expect((await engine.review(input)).code).toBe("review_capacity");
  engine.close();
  expect((await engine.review(input)).code).toBe("unloaded");
});
test("unload promptly settles a pending call including context fetch", async () => {
  const engine = new ReviewEngine(config(), {
    async generate() {
      return allowed;
    },
  });
  const pending = engine.review(input, () => new Promise(() => {}));
  engine.close();
  expect((await pending).code).toBe("unloaded");
});
test("no approval cache and unsafe inputs never reach model", async () => {
  let count = 0;
  const engine = new ReviewEngine(config(), {
    async generate() {
      count++;
      return allowed;
    },
  });
  await engine.review(input);
  await engine.review(input);
  await engine.review({
    command: "rm -rf src",
    resources: ["rm -rf src"],
    context: [],
  });
  expect(count).toBe(2);
});
test("audit contains only fixed metadata and tolerates sink failure", () => {
  let record = "";
  const logging = {
    enabled: true,
    level: "info",
    includeCommands: false,
    file: "/tmp/audit.jsonl",
  } as const;
  audit(
    logging,
    { ...ask("timeout"), reason: "provider SECRET" },
    12,
    (value) => {
      record = JSON.stringify(value);
    },
  );
  expect(record).toContain('"reason":"timeout"');
  expect(record).not.toContain("SECRET");
  expect(() =>
    audit(logging, ask("timeout"), 1, () => {
      throw new Error("disk");
    }),
  ).not.toThrow();
});
