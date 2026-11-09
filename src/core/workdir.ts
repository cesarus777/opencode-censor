import { lstat, realpath } from "node:fs/promises";
import { containsSensitiveData } from "../security/sanitization.js";
import { isAbsolute, relative, resolve, sep } from "node:path";

export class WorkdirFailure extends Error {
  constructor(readonly code: "invalid_workdir" | "external_workdir") {
    super(code);
  }
}

export interface DirectorySnapshot {
  root: string;
  path: string;
  workdir: string;
  identity: string;
}

// Reject symlink components, including links whose targets are inside the project.
// A symlinked project root itself is supported through its canonical identity.
export async function inspectWorkdir(
  directory: string,
  workdir: string | undefined,
  signal: AbortSignal,
): Promise<DirectorySnapshot> {
  const check = () => {
    if (signal.aborted) throw new Error("cancelled");
  };
  check();
  if (
    workdir !== undefined &&
    // FileAccess.resolve in host 2.2.5 expands these against the host home.
    // Reject before path.resolve can mistake a literal project ~/ directory
    // for the native execution location. Never disclose or depend on HOME.
    (workdir === "~" ||
      workdir.startsWith("~/") ||
      workdir.length > 4096 ||
      /[\u0000-\u001f\u007f]/.test(workdir) ||
      containsSensitiveData(workdir))
  )
    throw new WorkdirFailure("invalid_workdir");
  const root = await realpath(directory);
  const requested = resolve(directory, workdir ?? ".");
  const lexical = relative(resolve(directory), requested);
  const inside = (path: string) =>
    path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
  // Absolute paths using the canonical spelling are also valid with a linked root.
  const path = inside(lexical) ? resolve(root, lexical) : requested;
  const local = relative(root, path);
  if (!inside(local)) throw new WorkdirFailure("external_workdir");
  const stamps: string[] = [];
  let current = root;
  for (const part of ["", ...local.split(sep).filter(Boolean)]) {
    check();
    current = resolve(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new WorkdirFailure("invalid_workdir");
    stamps.push(`${stat.dev}:${stat.ino}`);
  }
  if ((await realpath(path)) !== path)
    throw new WorkdirFailure("invalid_workdir");
  check();
  return {
    root,
    path,
    workdir: local.split(sep).join("/") || ".",
    identity: JSON.stringify([root, path, stamps]),
  };
}
