import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { OpenCode } from "@opencode/client";
import { installedPackage } from "./package-check.js";
import { scannerFixtures } from "../tests/fixtures/scanner.js";
import { localProvider } from "./smoke-provider.js";

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
let server: ReturnType<typeof Bun.spawn> | undefined;
let reading: Promise<unknown> | undefined;
let output = "";
try {
  await mkdir(project);
  await writeFile(reportFile, "");
  await writeFile(
    resolve(project, "opencode.json"),
    JSON.stringify({
      plugins: [
        {
          package: artifact.packagePath,
          options: {
            model: { providerID: "smoke", id: "reviewer" },
            timeoutMs: 700,
            logging: { enabled: false },
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
    }),
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
        throw new Error("Native host exited during " + label + ": " + output);
      await Bun.sleep(50);
    }
    throw new Error(
      "Timed out: " +
        label +
        "; records=" +
        (await readFile(reportFile, "utf8")) +
        "; host=" +
        output,
    );
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
  const plugins = await client.plugin.list(
    { location: { directory: project } },
    request(),
  );
  if (!JSON.stringify(plugins).includes("opencode-censor"))
    throw new Error(
      "Installed package not loaded: " +
        JSON.stringify(plugins) +
        "; host=" +
        output,
    );
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
      if (errors)
        throw new Error(
          "Controlled session failed: " + JSON.stringify(errors.error),
        );
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
  const allowed = await probe("allow");
  await waitRecord("inert-allowed", allowed);
  await waitRecord("tool-completed", allowed);
  const source = (await records()).find(
    (r) => r.type === "source" && r.sessionID === allowed,
  );
  if (!source) throw new Error("Native source missing");
  const reviewCount = async () =>
    (await records()).filter((r) => r.type === "review-start").length;
  for (const [mode, text, reason] of [
    ["ask", "probe-pwd", "review requires approval"],
    ["allow", "probe-policy", "policy requires review"],
    ["error", "probe-pwd", "review error"],
  ] as const) {
    const before = await reviewCount();
    const id = await probe(mode, text);
    await until(
      async () =>
        (await client.permission.list({ sessionID: id }, request())).length > 0
          ? true
          : undefined,
      "native ask " + mode + text,
    );
    if (
      (await records()).some(
        (r) => r.type === "inert-allowed" && r.sessionID === id,
      )
    )
      throw new Error("Unexpected allow");
    const decision = (await records()).find(
      (r) => r.type === "evaluated" && r.sessionID === id,
    );
    if (decision?.message !== `OpenCode Censor: ${reason}.`)
      throw new Error(
        "Ask fallback reason mismatch: " + JSON.stringify(decision),
      );
    if ((await reviewCount()) - before !== (text === "probe-policy" ? 0 : 1))
      throw new Error("Unexpected reviewer admission");
  }
  const beforeDeny = await reviewCount();
  const denied = await probe("allow", "probe-deny");
  await waitRecord("tool-completed", denied);
  if (
    (await records()).some(
      (r) => r.type === "evaluated" && r.sessionID === denied,
    ) ||
    (await reviewCount()) !== beforeDeny
  )
    throw new Error("Native deny reached review");
  const slow = await probe("slow");
  await until(
    async () =>
      (await client.permission.list({ sessionID: slow }, request())).length > 0
        ? true
        : undefined,
    "timeout ask",
  );
  const timedOut = (await records()).find(
    (r) => r.type === "evaluated" && r.sessionID === slow,
  );
  if (timedOut?.message !== "OpenCode Censor: timeout.")
    throw new Error("Deadline fallback reason mismatch");
  await Bun.sleep(1800);
  if (
    !(await records()).some((r) => r.type === "review-end" && r.mode === "slow")
  )
    throw new Error("Late provider reply was not observed");
  if (
    (await client.permission.list({ sessionID: slow }, request())).length ===
      0 ||
    (await records()).some(
      (r) => r.type === "inert-allowed" && r.sessionID === slow,
    )
  )
    throw new Error("Late reply changed decision");
  const beforeBurst = await reviewCount();
  const burst = await Promise.all(
    Array.from({ length: 10 }, () => probe("slow")),
  );
  await Promise.all(
    burst.map((id) =>
      until(
        async () =>
          (await client.permission.list({ sessionID: id }, request())).length >
          0
            ? true
            : undefined,
        "concurrent timeout/capacity",
      ),
    ),
  );
  const burstReviews = (await reviewCount()) - beforeBurst;
  if (burstReviews !== 8)
    throw new Error(
      `Expected eight admitted reviews, received ${burstReviews}`,
    );
  if (
    !(await records()).some(
      (r) => r.type === "evaluated" && String(r.message).includes("capacity"),
    )
  )
    throw new Error("Overload fallback absent");
  await client.location.reload(request());
  await waitRecord("driver-unloaded");
  if (
    (await records()).some((r) =>
      ["shell-execution-blocked", "unexpected-missing-allow"].includes(
        String(r.type),
      ),
    )
  )
    throw new Error("Inert tool substitution failed");
  // Reload the installed plugin with generic project review enabled. The native
  // shell remains replaced with permission assertions throughout this phase.
  await writeFile(
    resolve(project, "build.ninja"),
    "rule inspect\n  command = pwd\nbuild check: inspect\n",
  );
  const configuration = JSON.parse(
    await readFile(resolve(project, "opencode.json"), "utf8"),
  );
  configuration.plugins[0].options.review = {
    strategy: "stateful",
    project: { allowFileContents: true, allowedPaths: ["build.ninja"] },
  };
  await writeFile(
    resolve(project, "opencode.json"),
    JSON.stringify(configuration),
  );
  await client.location.reload(request());
  for (const [mode, text] of [
    ["project", "probe-generic"],
    ["project-ask", "probe-generic"],
    ["project-missing", "probe-generic"],
    ["project", "probe-pwd"],
  ] as const) {
    const before = await reviewCount();
    const id = await probe(mode, text);
    if (mode === "project") await waitRecord("inert-allowed", id);
    else
      await until(
        async () =>
          (await client.permission.list({ sessionID: id }, request())).length >
          0
            ? true
            : undefined,
        "generic project ask",
      );
    if ((await reviewCount()) - before !== 2)
      throw new Error("Generic review must request evidence and then decide");
    const decision = (await records()).find(
      (record) => record.type === "evaluated" && record.sessionID === id,
    );
    const reason =
      mode === "project"
        ? "project review allowed"
        : mode === "project-ask"
          ? "project requires approval"
          : "evidence unavailable";
    if (decision?.message !== `OpenCode Censor: ${reason}.`)
      throw new Error(
        "Generic project decision mismatch: " + JSON.stringify(decision),
      );
    if (
      mode !== "project" &&
      (await records()).some(
        (record) => record.type === "inert-allowed" && record.sessionID === id,
      )
    )
      throw new Error("Generic project ask became allow");
  }
  // Original scanner phase. The pinned host's Shell.create awaits preparation
  // (scanner + permission.assert) before invoking spawner.spawn. The driver keeps
  // the original tool and forces native deny after recording our gate's effect.
  await mkdir(resolve(project, "packages/app"), { recursive: true });
  delete configuration.plugins[0].options.review;
  const scannerAudit = resolve(temporary, "scanner-audit.jsonl");
  configuration.plugins[0].options.logging = {
    enabled: true,
    includeCommands: false,
    file: scannerAudit,
  };
  configuration.plugins[1].options.originalScanner = true;
  configuration.plugins[1].options.scannerCommands = scannerFixtures.map(
    (fixture) => fixture.command,
  );
  await writeFile(
    resolve(project, "opencode.json"),
    JSON.stringify(configuration),
  );
  await client.location.reload(request());
  for (const fixture of scannerFixtures) {
    provider.setToolInput(fixture);
    const before = await reviewCount();
    const id = await probe("allow");
    const completed = await waitRecord("tool-completed", id);
    if (completed.status !== "error")
      throw new Error("Original scanner interception failed to stop the tool");
    const all = await records();
    const evaluated = all.find(
      (record) => record.type === "evaluated" && record.sessionID === id,
    );
    const source = all.find(
      (record) => record.type === "source" && record.sessionID === id,
    );
    const nativeSource = evaluated?.source as
      | Record<string, unknown>
      | undefined;
    if (
      !evaluated ||
      !source ||
      nativeSource?.messageID !== source.messageID ||
      nativeSource?.id !== source.id
    )
      throw new Error("Original scanner source correlation mismatch");
    if (evaluated.effect !== (fixture.inspection ? "allow" : "ask"))
      throw new Error(
        "Original scanner inspection path mismatch: " +
          JSON.stringify({ fixture, evaluated }),
      );
    if ((await reviewCount()) - before !== (fixture.inspection ? 1 : 0))
      throw new Error("Original scanner reviewer admission mismatch");
    if (
      all.some(
        (record) => record.type === "inert-allowed" && record.sessionID === id,
      )
    )
      throw new Error("Original scanner tool was replaced");
    const auditRecord = (await readFile(scannerAudit, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((record) => record.sessionID === id);
    if (
      auditRecord?.detailCode !==
      (fixture.inspection
        ? "review_allowed"
        : Array.isArray(evaluated.resources) && evaluated.resources.length > 1
          ? "multiple_resources"
          : "command_outside_grammar")
    )
      throw new Error("Original scanner audit diagnostic mismatch");
    console.log(
      "Scanner fixture: " +
        JSON.stringify({
          ...fixture,
          resources: evaluated.resources,
          message: evaluated.message,
          detailCode: auditRecord.detailCode,
        }),
    );
  }
  if (
    (await records()).filter(
      (record) => record.type === "original-shell-prepare",
    ).length !== scannerFixtures.length
  )
    throw new Error("Original scanner preparation count mismatch");
  const cancellation = (await records()).filter(
    (r) => r.type === "provider-abort",
  ).length;
  console.log(
    `PASS: installed archive in OpenCode 2.2.5; native source hooks; allow/ask/error/explicit deny; tool completion; timeout and late reply; 10 concurrent requests / 8 admitted; reload cleanup; generic evidence loop allow/ask/missing-file fallback; 13 original-scanner fixtures blocked before process creation. Provider abort observations: ${cancellation}.`,
  );
  console.log(
    "Scope: controlled loopback HTTP provider; inert replacement shell plus original-scanner phase with forced native deny before process creation. No reviewed command executed. Remote reviewer and interactive UI acceptance remain separate.",
  );
} finally {
  provider.stop();
  server?.kill("SIGKILL");
  if (server) await server.exited;
  await reading;
  await rm(temporary, { recursive: true, force: true });
  await rm(artifact.temp, { recursive: true, force: true });
}
