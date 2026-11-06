import type { Mode } from "../types.js";
import { containsSensitiveData } from "./sanitization.js";

// Deliberately no general shell parser: reject all syntax outside this closed
// language. Even a friendly model cannot extend the automatic approval surface.
export function candidate(command: string, mode: Mode): boolean {
  if (
    command.length > 300 ||
    containsSensitiveData(command) ||
    !/^[a-zA-Z0-9 .-]+$/.test(command)
  )
    return false;
  if (/^(pwd|git status(?: --short| --porcelain)?)$/.test(command)) return true;
  if (mode === "strict") return false;
  if (/^ls(?: -[alh]{1,3})?$/.test(command)) return true;
  if (
    /^git --no-pager diff --no-ext-diff --no-textconv(?: --stat| --name-only)?$/.test(
      command,
    )
  )
    return true;
  return (
    mode === "permissive" &&
    /^(git --no-pager log -[1-9]|git diff --stat|git diff --name-only)$/.test(
      command,
    )
  );
}
