import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OpenCode } from "@opencode/client";
import { installedPackage } from "./package-check.js";
import { localProvider } from "./smoke-provider.js";
import { selectFreeModel } from "./free-model.js";

const modelID = process.env.CENSOR_FREE_MODEL;
if (!modelID)
  throw new Error(
    "Set CENSOR_FREE_MODEL to an explicit built-in free model ID.",
  );
const binary = process.env.OPENCODE_BIN;
if (!binary) throw new Error("Set OPENCODE_BIN to an OpenCode 2.2.5 binary.");
const version = Bun.spawnSync([binary, "--version"]);
if (
  version.exitCode !== 0 ||
  !/^(?:opencode v)?2\.2\.5$/.test(version.stdout.toString().trim())
)
  throw new Error("Native smoke requires exactly OpenCode 2.2.5");
const root = resolve(import.meta.dir, "..");
const artifact = await installedPackage();
const temporary = await mkdtemp(resolve(root, ".smoke-"));
const project = resolve(temporary, "project");
const reportFile = resolve(temporary, "report.jsonl");
const provider = localProvider();
const auditFile = resolve(temporary, "audit.jsonl");
let server: ReturnType<typeof Bun.spawn> | undefined;
let reading: Promise<unknown> | undefined;
let output = "";
const watchdog = setTimeout(() => {
  server?.kill("SIGKILL");
}, 120000);
try {
  await mkdir(project);
  await writeFile(reportFile, "");
  const configuration = {
    plugins: [
      {
        package: artifact.packagePath,
        options: {
          model: { providerID: "opencode", id: modelID },
          timeoutMs: 15000,
          logging: { enabled: true, file: auditFile },
        },
      },
      {
        package: resolve(root, "tests/fixtures/live-driver"),
        options: { reportFile, providerURL: provider.url },
      },
    ],
    providers: {
      smoke: {
        package: "@ai-sdk/openai-compatible",
        env: ["CENSOR_SMOKE_KEY"],
        settings: { baseURL: provider.url, apiKey: "inert-key" },
        models: { reviewer: {}, working: {} },
      },
    },
    permissions: [
      { action: "shell", resource: "*", effect: "allow" },
      { action: "shell", resource: "git push *", effect: "deny" },
    ],
  };

  await writeFile(
    resolve(project, "opencode.json"),
    JSON.stringify({ ...configuration, plugins: [] }),
  );
  const password = crypto.randomUUID();
  server = Bun.spawn(
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
        OPENCODE_SERVER_PASSWORD: password,
        CENSOR_SMOKE_KEY: "inert-local-provider-key",
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  async function collect(stream: ReadableStream<Uint8Array>) {
    for await (const chunk of stream)
      output = (output + new TextDecoder().decode(chunk)).slice(-20000);
  }
  reading = Promise.all([
    collect(server.stdout as ReadableStream<Uint8Array>),
    collect(server.stderr as ReadableStream<Uint8Array>),
  ]);
  async function until<T>(
    check: () => Promise<T | undefined>,
    label: string,
  ): Promise<T> {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const value = await check();
      if (value !== undefined) return value;
      if (server?.exitCode !== null)
        throw new Error("Native host exited during " + label);
      await Bun.sleep(50);
    }
    throw new Error("Timed out: " + label);
  }
  const address = await until(
    async () => output.match(/https?:\/\/127\.0\.0\.1:\d+/)?.[0],
    "startup",
  );
  const client = OpenCode.make({
    baseUrl: address,
    headers: {
      Authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`,
    },
  });
  const request = () => ({ signal: AbortSignal.timeout(10000) });
  const catalog = await client.model.list(
    { location: { directory: project }, types: ["chat"] },
    request(),
  );
  const selected = selectFreeModel(catalog.data, modelID);
  console.log(
    JSON.stringify({
      type: "selected",
      host: "2.2.5",
      provider: selected.providerID,
      model: selected.id,
    }),
  );
  await writeFile(
    resolve(project, "opencode.json"),
    JSON.stringify(configuration),
  );
  await client.location.reload(request());
  const plugins = await client.plugin.list(
    { location: { directory: project } },
    request(),
  );
  if (!JSON.stringify(plugins).includes("opencode-censor"))
    throw new Error("Installed package not loaded");
  const records = async () =>
    (await readFile(reportFile, "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .concat(provider.records);
  const waitRecord = (type: string, sessionID?: string) =>
    until(async () => {
      const errors = (await records()).find(
        (record) =>
          record.type === "session-error" && record.sessionID === sessionID,
      );
      if (errors) throw new Error("Controlled session failed");
      const found = (await records()).find(
        (record) =>
          record.type === type &&
          (!sessionID || record.sessionID === sessionID),
      );
      if (found) return found;
      return undefined;
    }, type);
  async function probe(mode: string, text = "probe-pwd") {
    provider.setMode(mode);
    const session = await client.session.create(
      {
        title: "Inert native probe",
        model: { providerID: "smoke", id: "working" },
        location: { directory: project },
      },
      request(),
    );
    await client.session.prompt(
      { sessionID: session.id, text, resume: true },
      request(),
    );
    return session.id;
  }
  const missing = await waitRecord("missing-session");
  await until(
    async () =>
      (
        await client.permission.list(
          { sessionID: String(missing.sessionID) },
          request(),
        )
      ).length > 0
        ? true
        : undefined,
    "missing source asks",
  );
  const missingDecision = (await records()).find(
    (r) => r.type === "evaluated" && r.sessionID === missing.sessionID,
  );
  if (missingDecision?.message !== "OpenCode Censor: missing full command.")
    throw new Error("Missing-source fallback reason mismatch");
  const auditRecords = async (): Promise<Record<string, unknown>[]> => {
    try {
      return (await readFile(auditFile, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  };
  // These policy probes must complete before any remote reviewer is admitted.
  const policy = await probe("allow", "probe-policy");
  await waitRecord("evaluated", policy);
  if (
    (await waitRecord("evaluated", policy)).effect !== "ask" ||
    (await client.permission.list({ sessionID: policy }, request())).length ===
      0
  )
    throw new Error("Local policy failed to ask");
  const denied = await probe("allow", "probe-deny");
  await waitRecord("tool-completed", denied);
  if (
    (await records()).some(
      (record) => record.type === "evaluated" && record.sessionID === denied,
    )
  )
    throw new Error("Native deny reached evaluation");
  const before = await until(async () => {
    const entries = await auditRecords();
    return entries.length === 2 ? entries : undefined;
  }, "local probe audit");
  if (
    before.some(
      (record) =>
        record.reason !== "missing_full_command" &&
        record.reason !== "policy_requires_review",
    )
  )
    throw new Error("Unexpected local probe outcome");
  // One eligible command. Host-internal retries remain possible; no harness retry.
  const allowed = await probe("allow");
  const decision = await waitRecord("evaluated", allowed);
  const audit = await until(async () => {
    const entries = await auditRecords();
    return entries.length > before.length ? entries.at(-1) : undefined;
  }, "review audit");
  if (decision.effect === "allow") await waitRecord("inert-allowed", allowed);
  else
    await until(
      async () =>
        (await client.permission.list({ sessionID: allowed }, request()))
          .length > 0
          ? true
          : undefined,
      "fallback pending permission",
    );
  if (
    (await records()).some(
      (record) =>
        record.type === "shell-execution-blocked" ||
        record.type === "unexpected-missing-allow",
    )
  )
    throw new Error("Inert protection failed");
  console.log(
    JSON.stringify({
      type: "result",
      decision: decision.effect,
      reason: audit.reason,
      durationMs: audit.durationMs,
    }),
  );
  await client.location.reload(request());
  await waitRecord("driver-unloaded");
  if (decision.effect !== "allow")
    throw new Error(
      "Free reviewer acceptance incomplete; safe ask observed (see fixed reason above)",
    );
  console.log(
    "PASS: installed archive, built-in free reviewer, inert allow, local policy ask, native deny and reload cleanup. Original scanner and interactive UI remain untested.",
  );
} finally {
  clearTimeout(watchdog);
  provider.stop();
  server?.kill("SIGKILL");
  if (server) await server.exited;
  await reading;
  await rm(temporary, { recursive: true, force: true });
  await rm(artifact.temp, { recursive: true, force: true });
}
