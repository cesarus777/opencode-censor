import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dir, "..");
const packageName = "@cesarus777/opencode-censor";
export async function installedPackage() {
  const temp = await mkdtemp(join(tmpdir(), "opencode-censor-package-"));
  function run(command: string, args: string[], cwd: string) {
    const result = spawnSync(command, args, {
      cwd,
      encoding: "utf8",
      timeout: 60000,
      env: {
        ...process.env,
        npm_config_cache: join(tmpdir(), "opencode-censor-npm-cache"),
      },
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
    if (!("files" in report) || !Array.isArray(report.files))
      throw new Error("Missing archive contents");
    const paths = report.files.map((file: { path: string }) => file.path);
    for (const required of [
      "dist/index.js",
      "dist/index.d.ts",
      "README.md",
      "SECURITY.md",
      "LICENSE",
      "CHANGELOG.md",
      "docs/RELEASE-CHECKLIST.md",
    ])
      if (!paths.includes(required))
        throw new Error(`Missing archive file: ${required}`);
    for (const path of paths)
      if (
        !/^(dist\/|docs\/|examples\/|package\.json$|README\.md$|SECURITY\.md$|LICENSE$|CHANGELOG\.md$)/.test(
          path,
        )
      )
        throw new Error(`Unexpected archive file: ${path}`);
    const filename: unknown = report.filename;
    if (typeof filename !== "string" || filename.includes("/"))
      throw new Error("Invalid archive name");
    console.log("Archive contents inspected.");
    const consumer = join(temp, "consumer");
    await mkdir(consumer);
    await writeFile(
      join(consumer, "package.json"),
      JSON.stringify({
        type: "module",
        dependencies: {
          [packageName]: `file:${join(temp, filename)}`,
        },
      }),
    );
    run(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--prefer-offline",
      ],
      consumer,
    );
    console.log("Archive installed with lifecycle scripts disabled.");
    await writeFile(
      join(consumer, "check.mjs"),
      `import plugin from ${JSON.stringify(packageName)}; if (plugin.id !== "opencode-censor" || typeof plugin.setup !== "function") throw new Error("Invalid export"); console.log("Package import OK");`,
    );
    run(process.execPath, ["run", "check.mjs"], consumer);
    run("node", ["check.mjs"], consumer);
    run(
      "node",
      [
        join(consumer, "node_modules", packageName, "dist", "stats.js"),
        "--help",
      ],
      consumer,
    );
    const manifest = JSON.parse(
      await readFile(
        join(consumer, "node_modules", packageName, "package.json"),
        "utf8",
      ),
    ) as { exports: unknown };
    if (!manifest.exports) throw new Error("Missing exports");
    return {
      temp,
      consumer,
      packagePath: join(consumer, "node_modules", packageName),
      tarball: join(temp, filename),
      files: paths.length,
    };
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
}
if (import.meta.main) {
  const artifact = await installedPackage();
  try {
    console.log(
      `PASS: inspected ${artifact.files} archive files; installed with lifecycle scripts disabled; Bun and Node ESM exports imported.`,
    );
  } finally {
    await rm(artifact.temp, { recursive: true, force: true });
  }
}
