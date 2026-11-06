import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OpenCode } from "@opencode/client";

const binary = process.env.OPENCODE_BIN;
if (!binary) {
  console.error(
    "Set OPENCODE_BIN to an OpenCode 2.2.5 binary. This probe uses an isolated config, no provider credentials and no command execution.",
  );
  process.exit(2);
}
const root = resolve(import.meta.dir, "..");
const temporary = await mkdtemp(resolve(root, ".smoke-"));
const project = resolve(temporary, "project");
await mkdir(project);
const reportFile = resolve(temporary, "report.jsonl");
await writeFile(reportFile, "");
await writeFile(
  resolve(project, "opencode.json"),
  JSON.stringify({
    plugins: [
      {
        package: root,
        options: {
          model: { providerID: "nonexistent", id: "nonexistent" },
          logging: { enabled: false },
        },
      },
      {
        package: resolve(root, "tests/fixtures/live-driver"),
        options: { reportFile },
      },
    ],
    permissions: [
      { action: "shell", resource: "*", effect: "allow" },
      { action: "shell", resource: "git push *", effect: "deny" },
    ],
  }),
);
const server = Bun.spawn(
  [binary, "serve", "--hostname", "127.0.0.1", "--port", "0"],
  {
    cwd: project,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: temporary,
      XDG_CONFIG_HOME: resolve(temporary, "config"),
      XDG_DATA_HOME: resolve(temporary, "data"),
      XDG_STATE_HOME: resolve(temporary, "state"),
      XDG_CACHE_HOME: resolve(temporary, "cache"),
    },
    stdout: "pipe",
    stderr: "pipe",
  },
);
let output = "";
async function collect(stream: ReadableStream<Uint8Array>) {
  for await (const chunk of stream)
    output = (output + new TextDecoder().decode(chunk)).slice(-20000);
}
const reading = Promise.all([collect(server.stdout), collect(server.stderr)]);
const deadline = Date.now() + 30000;
try {
  let address: string | undefined;
  while (Date.now() < deadline) {
    address = output.match(/https?:\/\/127\.0\.0\.1:\d+/)?.[0];
    if (address) break;
    if (server.exitCode !== null) {
      await reading;
      throw new Error("OpenCode exited: " + output);
    }
    await Bun.sleep(100);
  }
  if (!address) throw new Error("Server startup timed out: " + output);
  const client = OpenCode.make({ baseUrl: address });
  const plugins = await client.plugin.list(
    { location: { directory: project } },
    { signal: AbortSignal.timeout(15000) },
  );
  if (!JSON.stringify(plugins).includes("opencode-censor"))
    throw new Error("Package not loaded");
  while (Date.now() < deadline) {
    const records = (await readFile(reportFile, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    if (
      records.some((r) =>
        ["deny-bypassed", "unexpected-approval", "probe-error"].includes(
          String(r.type),
        ),
      )
    )
      throw new Error(
        "Native permission probe failed: " + JSON.stringify(records),
      );
    const session = records.find((r) => r.type === "session");
    if (
      session &&
      records.some((r) => r.type === "deny-preserved") &&
      records.some((r) => r.type === "evaluated" && r.effect === "ask")
    ) {
      const pending = await client.permission.list(
        { sessionID: String(session.sessionID) },
        { signal: AbortSignal.timeout(5000) },
      );
      if (pending.length > 0) {
        if (
          records.some(
            (r) =>
              r.type === "evaluated" &&
              JSON.stringify(r.resources).includes("push"),
          )
        )
          throw new Error("Explicit deny reached hook");
        console.log(
          "PASS: installed package loaded in native OpenCode; explicit deny skipped evaluate; incomplete source changed allow to ask and published a native approval request.",
        );
        console.log(
          "Scope: no live model or shell execution; model success/error paths are mocked tests.",
        );
        process.exitCode = 0;
        break;
      }
    }
    await Bun.sleep(100);
  }
  if (process.exitCode !== 0)
    throw new Error(
      "Native probe timed out: " +
        (await readFile(reportFile, "utf8")) +
        "\n" +
        output,
    );
} finally {
  server.kill();
  await server.exited;
  await reading;
  await rm(temporary, { recursive: true, force: true });
}
