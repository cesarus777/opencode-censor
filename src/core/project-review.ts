import { constants } from "node:fs";
import { lstat, open, opendir, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { Config } from "../config/schema.js";
import { containsSensitiveData } from "../security/sanitization.js";
import type { EvidenceRequest } from "./project-protocol.js";

export class EvidenceFailure extends Error {
  constructor(
    public readonly code:
      | "evidence_unavailable"
      | "evidence_sensitive"
      | "evidence_budget",
  ) {
    super(code);
  }
}
export interface EvidenceResult {
  id: string;
  request: EvidenceRequest;
  status: "ok" | "unavailable";
  code?: string;
  data?: unknown;
  fingerprint?: string;
}
export interface EvidenceStamp {
  action: "read" | "list";
  path: string;
  fingerprint: string;
}
export interface EvidenceSession {
  request(request: EvidenceRequest): Promise<EvidenceResult>;
  unchanged(): Promise<boolean>;
  stamps(): EvidenceStamp[];
}
export interface EvidenceSource {
  create(signal: AbortSignal): EvidenceSession;
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const within = (path: string, prefix: string) =>
  prefix === "." || path === prefix || path.startsWith(`${prefix}/`);
const fail = (
  code: EvidenceFailure["code"] = "evidence_unavailable",
): never => {
  throw new EvidenceFailure(code);
};
const builtInExcluded = [
  ".git",
  "node_modules",
  ".ssh",
  ".aws",
  ".codex",
  ".agents",
  ".gnupg",
];

export class ProjectEvidence implements EvidenceSource {
  constructor(
    private readonly directory: string,
    private readonly config: Config["review"]["project"],
  ) {}
  create(signal: AbortSignal): EvidenceSession {
    return new FileEvidenceSession(this.directory, this.config, signal);
  }
}

class FileEvidenceSession implements EvidenceSession {
  private readonly snapshots = new Map<
    string,
    { stamp: EvidenceStamp; data: unknown }
  >();
  private bytes = 0;
  private files = 0;
  private directories = 0;
  private entries = 0;
  private requests = 0;
  private root: string | undefined;
  constructor(
    private readonly directory: string,
    private readonly config: Config["review"]["project"],
    private readonly signal: AbortSignal,
  ) {}
  private check() {
    if (this.signal.aborted || !this.config.allowFileContents) fail();
  }
  private permitted(path: string, navigation = false): boolean {
    if (
      path !== "." &&
      (!/^[a-zA-Z0-9_. /-]+$/.test(path) ||
        path.startsWith("/") ||
        path.split("/").some((part) => !part || part === "." || part === ".."))
    )
      return false;
    if (
      containsSensitiveData(path) ||
      /(?:^|\/)(?:id_rsa|id_ed25519|\.npmrc|\.netrc|\.pypirc)(?:$|\/)/i.test(
        path,
      ) ||
      path.split("/").some((part) => builtInExcluded.includes(part)) ||
      this.config.excludedPaths.some((prefix) => within(path, prefix))
    )
      return false;
    return this.config.allowedPaths.some(
      (prefix) => within(path, prefix) || (navigation && within(prefix, path)),
    );
  }
  private async location(path: string, navigation = false): Promise<string> {
    this.check();
    if (!this.permitted(path, navigation)) return fail();
    this.root ??= await realpath(this.directory);
    let current = this.root;
    if (path !== ".")
      for (const part of path.split("/")) {
        current = resolve(current, part);
        if ((await lstat(current)).isSymbolicLink()) return fail();
      }
    if ((await realpath(current)) !== current) return fail();
    return current;
  }
  private async read(
    path: string,
  ): Promise<{ content: string; fingerprint: string }> {
    const key = `read:${path}`;
    const previous = this.snapshots.get(key);
    if (previous)
      return {
        content: previous.data as string,
        fingerprint: previous.stamp.fingerprint,
      };
    const location = await this.location(path);
    if (++this.files > this.config.maxFiles) return fail("evidence_budget");
    const handle = await open(
      location,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    let content: string;
    try {
      const before = await handle.stat();
      if (!before.isFile() || before.size > this.config.maxFileBytes)
        return fail("evidence_budget");
      const buffer = Buffer.alloc(this.config.maxFileBytes + 1);
      let count = 0;
      while (count < buffer.length) {
        this.check();
        const result = await handle.read(
          buffer,
          count,
          buffer.length - count,
          null,
        );
        if (!result.bytesRead) break;
        count += result.bytesRead;
      }
      this.bytes += count;
      if (
        count > this.config.maxFileBytes ||
        this.bytes > this.config.maxTotalBytes
      )
        return fail("evidence_budget");
      const after = await handle.stat();
      const located = await lstat(await this.location(path));
      if (
        located.dev !== before.dev ||
        located.ino !== before.ino ||
        after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs
      )
        return fail();
      content = new TextDecoder("utf-8", { fatal: true }).decode(
        buffer.subarray(0, count),
      );
    } finally {
      await handle.close();
    }
    this.check();
    if (containsSensitiveData(content)) return fail("evidence_sensitive");
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(content))
      return fail();
    const fingerprint = hash(content);
    this.snapshots.set(key, {
      stamp: { action: "read", path, fingerprint },
      data: content,
    });
    return { content, fingerprint };
  }
  private async list(path: string): Promise<{
    entries: { path: string; kind: "file" | "directory" }[];
    fingerprint: string;
  }> {
    const key = `list:${path}`;
    const previous = this.snapshots.get(key);
    if (previous)
      return {
        entries: previous.data as {
          path: string;
          kind: "file" | "directory";
        }[],
        fingerprint: previous.stamp.fingerprint,
      };
    const location = await this.location(path, true);
    if (++this.directories > this.config.maxFiles)
      return fail("evidence_budget");
    const entries: { path: string; kind: "file" | "directory" }[] = [];
    const dir = await opendir(location);
    try {
      for await (const entry of dir) {
        this.check();
        if (++this.entries > this.config.maxDirectoryEntries)
          return fail("evidence_budget");
        const child = path === "." ? entry.name : `${path}/${entry.name}`;
        if (!this.permitted(child, true) || entry.isSymbolicLink()) continue;
        if (entry.isFile() || entry.isDirectory())
          entries.push({
            path: child,
            kind: entry.isFile() ? "file" : "directory",
          });
      }
    } finally {
      try {
        await dir.close();
      } catch {
        /* Iterator may already have closed it. */
      }
    }
    await this.location(path, true);
    entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const fingerprint = hash(JSON.stringify(entries));
    this.snapshots.set(key, {
      stamp: { action: "list", path, fingerprint },
      data: entries,
    });
    return { entries, fingerprint };
  }
  async request(request: EvidenceRequest): Promise<EvidenceResult> {
    const id = `e${++this.requests}`;
    try {
      this.check();
      if (this.requests > 16) return fail("evidence_budget");
      if (request.action === "read") {
        const result = await this.read(request.path);
        return {
          id,
          request,
          status: "ok",
          data: { content: result.content, complete: true },
          fingerprint: result.fingerprint,
        };
      }
      if (request.action === "list") {
        const result = await this.list(request.path);
        return {
          id,
          request,
          status: "ok",
          data: { entries: result.entries, scope: "permitted_paths_only" },
          fingerprint: result.fingerprint,
        };
      }
      if (containsSensitiveData(request.query))
        return fail("evidence_sensitive");
      const matches: { path: string; line: number; text: string }[] = [];
      const walk = async (path: string, depth: number): Promise<void> => {
        if (depth > 16) return fail("evidence_budget");
        const { entries } = await this.list(path);
        for (const entry of entries) {
          if (entry.kind === "directory") await walk(entry.path, depth + 1);
          else {
            const { content } = await this.read(entry.path);
            const lines = content.split(/\r?\n/);
            for (let index = 0; index < lines.length; index++)
              if (lines[index]!.includes(request.query)) {
                if (matches.length >= 32 || lines[index]!.length > 300)
                  return fail("evidence_budget");
                matches.push({
                  path: entry.path,
                  line: index + 1,
                  text: lines[index]!,
                });
              }
          }
        }
      };
      await walk(request.path, 0);
      return {
        id,
        request,
        status: "ok",
        data: { matches, complete: true, scope: "permitted_paths_only" },
        fingerprint: hash(JSON.stringify(matches)),
      };
    } catch (error) {
      return {
        id,
        request,
        status: "unavailable",
        code:
          error instanceof EvidenceFailure
            ? error.code
            : "evidence_unavailable",
      };
    }
  }
  stamps(): EvidenceStamp[] {
    return [...this.snapshots.values()].map((value) => value.stamp);
  }
  async unchanged(): Promise<boolean> {
    try {
      const fresh = new FileEvidenceSession(
        this.directory,
        this.config,
        this.signal,
      );
      for (const { stamp } of this.snapshots.values()) {
        const result =
          stamp.action === "read"
            ? await fresh.read(stamp.path)
            : await fresh.list(stamp.path);
        if (result.fingerprint !== stamp.fingerprint) return false;
      }
      return !this.signal.aborted;
    } catch {
      return false;
    }
  }
}
