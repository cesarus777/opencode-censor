import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dir, "..");
const temp = await mkdtemp(join(tmpdir(), "opencode-censor-package-"));
function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_cache: join(temp, "npm-cache") },
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed: ${result.stderr}\n${result.stdout}`);
  if (!result.stdout.trim() && command === "npm")
    throw new Error(
      "npm produced no pack report; subprocess execution may be restricted",
    );
  return result.stdout;
}
try {
  const packed: unknown = JSON.parse(
    run(
      "npm",
      ["pack", "--json", "--ignore-scripts", "--pack-destination", temp],
      root,
    ),
  );
  const reports: unknown[] = Array.isArray(packed)
    ? packed
    : packed !== null && typeof packed === "object"
      ? Object.values(packed)
      : [];
  const report = reports[0];
  if (
    reports.length !== 1 ||
    report === null ||
    typeof report !== "object" ||
    !("filename" in report)
  )
    throw new Error("Invalid pack report");
  const filename: unknown = report.filename;
  if (typeof filename !== "string" || filename.includes("/"))
    throw new Error("Invalid archive name");
  const consumer = join(temp, "consumer");
  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({
      type: "module",
      dependencies: {
        "opencode-censor": `file:${join(temp, filename)}`,
      },
    }),
  );
  run(process.execPath, ["install", "--offline", "--ignore-scripts"], consumer);
  await writeFile(
    join(consumer, "check.ts"),
    `import plugin from "opencode-censor"; if (plugin.id !== "opencode-censor" || typeof plugin.setup !== "function") throw new Error("Invalid export"); console.log("Package import OK");`,
  );
  run(process.execPath, ["run", "check.ts"], consumer);
  const manifest = JSON.parse(
    await readFile(
      join(consumer, "node_modules/opencode-censor/package.json"),
      "utf8",
    ),
  ) as { exports: unknown };
  if (!manifest.exports) throw new Error("Missing exports");
  console.log(
    "PASS: npm tarball built, installed offline in an isolated consumer, and imported through package exports.",
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
