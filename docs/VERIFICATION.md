# Verification record

Environment: Linux x64, 2026-11-06. Target SDK and native CLI: **2.2.5**. Development uses Bun **1.3.11** from `/tmp/guard-terminal-runtime/node_modules/@oven/bun-linux-x64/bin/bun`; the default system Bun is 1.1.34 and is unsuitable. Node **26.11.1**, TypeScript 5.9.3, Prettier 3.6.2. The existing system OpenCode 2.1.2 was not modified.

The final readiness checks are recorded below; unconfirmed and blocked entries are not passes. The full acceptance criteria are in [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md).

| Check                                          | Result                  | Evidence / boundary                                                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen dependency installation                 | PASS                    | Bun 1.3.11; pinned `bun.lock`; 267 packages checked with no changes                                                                                                                                                        |
| Typecheck                                      | PASS                    | Strict TypeScript against installed SDK 2.2.5, including scripts and driver                                                                                                                                                |
| Formatting                                     | PASS                    | Prettier check on the final implementation and documentation                                                                                                                                                               |
| Unit/security/mock-host integration            | PASS                    | 95 tests, 0 failed; no reviewed string executed; SDK entrypoint tested against injected mock domains                                                                                                                       |
| Build                                          | PASS                    | ESM JavaScript, source maps and declarations                                                                                                                                                                               |
| Archive inspection and standalone installation | PASS outside sandbox    | Inspected 45 archive paths and required documentation; npm install with lifecycle scripts disabled into an isolated consumer; public exports imported in Bun 1.3.11 and Node 26.11.1                                       |
| Original native host probe                     | PASS outside sandbox    | After adding temporary Basic authentication: configured deny skipped evaluate; missing source changed allow to ask and published a native pending request. This older probe loaded the checkout, not the installed archive |
| Expanded installed-package native smoke        | PASS outside sandbox    | Controlled loopback HTTP provider and inert shell; detailed outcome below                                                                                                                                                  |
| Native CI                                      | ADDED, NOT RUN REMOTELY | Bun 1.3.11, Node 22 and host 2.2.5; no external provider credentials. No push was authorized                                                                                                                               |
| Dependency audit                               | TWO MODERATE ADVISORIES | `bun audit --json` outside sandbox; details below; nonzero exit was retained as a finding                                                                                                                                  |
| Remote reviewer                                | BLOCKED                 | No common provider API-key environment variables were configured; no independent reviewer account/model was supplied. No stored account credential files were read                                                         |
| Interactive approval and original scanner      | NOT RUN                 | No interactive native client attached. Pending request publication is separate from visible approval/rejection and actual built-in shell behavior                                                                          |
| Private vulnerability reporting                | UNCONFIRMED             | Repository URL supplied and origin confirmed; GitHub CLI unavailable; advisory creation page could not be fetched. SECURITY.md links the intended route conditionally; maintainer must enable/test it                      |
| npm ownership                                  | UNCONFIRMED             | Earlier `npm view opencode-censor version` returned E404 on this date; availability is not ownership                                                                                                                       |
| Publication / push / tag / release             | NOT RUN                 | Explicitly outside this task's authorization                                                                                                                                                                               |

## Native probe and restrictions

`scripts/live-smoke.ts` requires exactly OpenCode 2.2.5. It packs and installs the current archive into an isolated consumer and loads that installation in an isolated host. It uses a deterministic loopback HTTP provider and replaces shell execution with permission assertions carrying actual native tool-context identifiers. A separate shell-creation guard rejects any attempted real shell creation. No reviewed command string is executed; no pending permission is automatically approved or replied to.

Coverage exercised by the harness: native source correlation, allow, model ask, policy ask, provider error, explicit deny bypass, tool completion, timeout, late allow, ten concurrent requests with eight admitted reviews, overload and reload cleanup. The original scanner/executor is substituted; generation uses the real native HTTP transport against a loopback OpenAI-compatible provider. Deterministic unit/mock-host tests separately cover late rejected promises, unchanged effects after unload, context-fetch cancellation, partial setup failure and source mutation.

The final `bun run check` passed typecheck, formatting, all 95 tests (205 assertions) and build inside the sandbox; its package stage received no npm pack report. The package stage was escalated separately, as recorded in the table.

The sandboxed host attempt exited without startup diagnostics; the earlier environment also reported loopback `EPERM`. The check was rerun with explicit escalation. The first outside-sandbox probe needed temporary Basic auth. The expanded probe in an unrelated `/tmp` project initially returned an empty native plugin list, so its temporary project was moved under the checkout, matching the original probe's project association.

Bun's isolated offline archive installation stalled and was bounded to fail rather than hang. The package checker now uses npm with lifecycle scripts disabled and a cache under `/tmp`; dependency registry access may be required. Package subprocesses have a 60-second limit. A package import proves standalone exports, not host permission ordering.

## Dependency audit triage

The locked graph contains `glob` 13.0.5 and 10.5.0 and `minimatch` 10.2.5 and 9.0.9. Bun's registry audit reports:

- [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), moderate: glob cancellation can leave filesystem traversal running. The advisory identifies 14.0.2 as patched.
- [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), moderate: minimatch pattern amplification can exhaust resources. The advisory identifies 11.0.1 as patched.

These enter through `@opencode/plugin@2.2.5` → `@opencode/util@2.2.5` (direct glob/minimatch and npm tooling), with older nested versions through gcp-metadata/gaxios/rimraf. The plugin's review path never imports or calls glob/minimatch or accepts arbitrary glob patterns. That limits direct exposure; it does not prove SDK/host package-management paths unaffected. Major-version overrides would depart from the inspected pinned SDK dependency contract and have not been imposed without compatibility evidence. Both findings remain release triage blockers requiring an upstream fix or explicit maintainer acceptance. The advisory audit does not cover every supply-chain risk.

## Remaining deployment acceptance

Follow the unchecked real-provider and interactive-client items in the release checklist. In particular, verify exact `pwd` against the native built-in scanner and reviewer, reject a harmless out-of-policy request in the UI, confirm unavailable/slow reviewer fallback, and test actual deployed plugin order. SDK 2.2.5 ignores Promise generation request options, so prompt waiting is bounded but provider cancellation/cost is not guaranteed. Never claim production acceptance from compile-time compatibility or mocked/local-provider results alone.

## Native run outcome

The expanded installed-archive smoke passed outside the sandbox on 2026-11-06 with host 2.2.5. It observed native source hooks and inert allow; pending requests for missing source, reviewer ask, policy ask and provider error; explicit deny bypass; timeout with a late reply leaving the request pending; ten concurrent sessions admitting exactly eight unsettled reviewer requests; and driver cleanup on reload while delayed reviews remained unsettled. **Zero provider abort events** were observed by the loopback server. Deadline and reload did not establish transport cancellation. No reviewed string ran in a shell.
