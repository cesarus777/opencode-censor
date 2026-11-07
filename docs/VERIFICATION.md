# Approved npm publication — 2026-11-07

The maintainer approved staged `@cesarus777/opencode-censor@0.1.1` with npm 2FA. Registry metadata now reports `latest: 0.1.1` and SHA-1 `c8a0a08cdb286288d3176405c42a91247666bc16`. The downloaded public tarball matches that checksum; its `dist/index.js` and `dist/stats.js` match the local build byte-for-byte, and its package metadata exposes `censor-stats`. This confirms publication, not real-provider or interactive-client acceptance.

# GitHub staged release result — 2026-11-07

Manual GitHub Actions run [42387293653](https://github.com/cesarus777/opencode-censor/actions/runs/42387293653) on commit `52e8e13` completed successfully. Its validation, controlled native smoke, archive inspection/standalone installation, and `npm stage publish` steps all passed. npm registry metadata still reported `latest: 0.1.0` immediately afterward, consistent with 0.1.1 awaiting maintainer review and 2FA approval. Approval and live publication have not yet been verified.

# Staged 0.1.1 workflow — 2026-11-07

The two `v0.1.1` tag workflow attempts passed validation and native smoke, but direct `npm publish` failed with `E403 OIDC permission denied for this action`: the trusted publisher allows staging but not direct publication. The workflow now uses npm 11.21.0 and `npm stage publish`, and supports a manual `main` run with an explicit matching version so the already-pushed tag does not need rewriting. The exact npm stage command passed a local dry run against the inspected 0.1.1 archive; this did not submit it. npm approval with 2FA remains necessary before the version becomes public. The earlier local direct publish attempt was rejected with `EOTP`; a proposed local staging command was interrupted before a result was returned, so it is not counted as a successful stage.

# Version 0.1.1 release preflight — 2026-11-07

The scoped package version was bumped to 0.1.1 for separate JSONL audit output and `censor-stats`. Frozen installation, Bun 1.3.11 typecheck, formatting, 98 deterministic tests (210 assertions), build, package inspection and standalone Bun/Node imports passed. The package stage required execution outside the sandbox because sandboxed npm pack produced no report. The installed-archive native smoke passed with OpenCode 2.2.5, a controlled loopback provider, and an inert shell; provider abort observations were zero. The first smoke attempt used a non-executable npm shim and was rerun with the actual binary. The original scanner, remote reviewer and interactive client remain untested. Registry metadata showed scoped 0.1.0 owned by cesarus777 before publication.

# Local audit reporting — 2026-11-07

Added a dedicated JSONL audit file and `censor-stats` command. The report counts plugin `allow` and `ask` decisions and states that native denies and later human outcomes are excluded. Bun 1.3.11 typecheck, lint, 98 tests (210 assertions), build, and standalone package check passed. The installed archive contained 54 files and passed Bun and Node ESM imports. The built stats command reported 1 / 2 (50.0%) on a synthetic audit file. Unit tests cover file output, count accuracy, and malformed records. No live OpenCode provider or native scanner was used for this change. File write failure remains fail-safe for permission decisions but may make reports incomplete.

# Verification record

## Scoped package migration — 2026-11-07

The operator authorized publishing `@cesarus777/opencode-censor@0.1.0`, updating installation examples and the tag workflow, and deprecating `opencode-censor` with a migration notice after verifying the scoped publication. The native plugin ID and permission behavior remain unchanged. The lockfile's workspace name changes without dependency updates. The archive checker imports the scoped package from its actual scoped installation path and returns npm's reported tarball path to the workflow, avoiding invalid filenames containing a scope slash.

The registry audit still reports the same two accepted moderate transitive advisories; neither is fixed. Previously deferred deployment and private reporting checks remain deferred. The records below this section describe the earlier unscoped release.

Scoped-package validation passed locally: frozen installation, typecheck, formatting, all 95 tests under Bun 1.3.11, build and actionlint 1.7.7. The scoped archive's 45 files were inspected and installed with lifecycle scripts disabled; Bun and Node imports and the installed-package native host 2.2.5 smoke passed outside the sandbox. The native smoke still uses an inert shell and controlled provider and observed zero provider aborts. Remote Actions and scoped trusted-publisher setup remain unverified.

The exact updated workflow archive step also passed locally, exporting npm's actual scoped tarball filename; the scoped tag guard accepted the matching tag and rejected mismatches, prereleases and missing prefixes. Publication completed after npm browser authentication. Registry metadata confirms `@cesarus777/opencode-censor@0.1.0`, maintainer `cesarus777`, `latest: 0.1.0`, and SHA-1 `13fce4750746539a45fcb26d0103f9e46f2b4821`, matching the tested tarball. The registry initially returned E404 during processing and subsequently exposed the verified version.

After verifying the scoped release, the old `opencode-censor` package was deprecated through npm after a separate browser authentication. Registry metadata confirms the notice directs users to `@cesarus777/opencode-censor@0.1.0` and warns against loading both packages. No package was unpublished. Publication and deprecation outcomes were added to the checkout after the archive was published. No migration commit, remote push, tag or GitHub release was created.

## Tag-triggered publication workflow

Added `.github/workflows/publish.yml` to publish stable `v<version>` tags matching `package.json`. It runs the full package checks and pinned native smoke before inspecting, installing and publishing the exact final archive. Authentication uses npm trusted publishing with GitHub OIDC and provenance. The npm owner must configure repository `cesarus777/opencode-censor`, workflow filename `publish.yml`, no environment, and direct `npm publish` permission in the package settings before use. No npm token is stored in the workflow.

Local validation passed: actionlint 1.7.7 (including shellcheck), Prettier, diff checks, and execution of the tag guard against matching, mismatched, prerelease, missing-prefix and shell-text tags. The exact archive-preparation step ran locally outside the sandbox: 45 archive files inspected, standalone installation and Bun/Node imports passed, and the exported Actions output pointed to the retained tarball. The workflow pins npm 11.6.2 for trusted-publishing support.

The workflow has not run in GitHub Actions, and the trusted publisher configuration has not been verified. Adding this file did not push a tag or publish another version. Existing local release verification below does not establish a remote workflow pass.

## Authorized publication preflight — 2026-11-07

The operator reversed the earlier release-blocking decision, explicitly accepted the two documented moderate transitive `glob` and `minimatch` advisories, and authorized publication of `opencode-censor@0.1.0` to npm. The latest registry audit still reports both advisories; neither is fixed. The earlier records below describe historical decisions and are superseded by this acceptance.

Final frozen installation passed with Bun 1.3.11 and no dependency changes. Typecheck, formatting, all 95 deterministic tests and build passed again with Node 26.11.1 available. npm authentication confirms `cesarus777`; the final preflight name lookup returned E404. Archive inspection (45 files), isolated installation with lifecycle scripts disabled, Bun/Node imports and the installed-package native smoke all passed outside the sandbox. The smoke again covered source hooks, allow/ask/error/deny, completion, timeout and late reply, ten concurrent requests with eight admitted reviews, and reload cleanup. Provider abort observations remained zero. Its controlled provider and inert shell do not validate the real scanner or interactive client.

Real-provider, native scanner, interactive approval and private vulnerability-reporting checks remain deferred by the operator until after release. Remote GitHub Actions execution is unverified. Production acceptance is incomplete. At publication, only npm publication was authorized; remote push, tags and GitHub releases were outside that authorization.

Publication completed after the operator authenticated through npm's browser two-factor flow. The exact inspected and installed tarball was published with lifecycle scripts disabled. Registry metadata confirms `opencode-censor@0.1.0`, maintainer `cesarus777` and `latest: 0.1.0`. Its SHA-1 checksum `f0252d122d153497415f603ededcd2459d9cf2e6` matches the tested archive. The archive contains the prepublication verification record; this outcome was added to the checkout after publication. No remote push, tag or GitHub release was performed.

## Release readiness recheck — 2026-11-07

Rechecked commit `cb135f0` on 2026-11-07, before the documentation updates below. Bun 1.3.11 and Node 26.11.1 were used; the default Bun remains 1.1.34 and must not be used for release checks.

- Frozen installation passed without dependency changes. Typecheck, formatting, all 95 deterministic tests (205 assertions), and build passed.
- The combined `bun run check` stopped at the sandboxed package subprocess, which produced no npm pack report. The separately escalated package check passed: 45 archive files inspected, isolated installation with lifecycle scripts disabled, and public ESM imports in Bun and Node.
- The installed-archive native smoke passed outside the sandbox with host 2.2.5: source correlation, allow/ask/error/deny, tool completion, timeout and late reply, ten concurrent requests with eight admitted reviews, and reload cleanup. Provider abort observations remained zero. The sandboxed attempt failed the version preflight after the host could not open its normal log path; that attempt is not a pass.
- A fresh registry audit still reports the same two moderate transitive advisories described below. No dependency override or SDK upgrade was applied. The operator explicitly chose to keep the release blocked pending a dependency fix; the remaining risk is not accepted.
- `npm view opencode-censor name version maintainers --json` returned E404. An escalated `npm whoami --json` authenticated as `cesarus777`; the sandboxed account lookup failed DNS resolution. The account and available name are confirmed, but ownership of an unpublished name cannot be established in advance and publish permission was not exercised.
- The private reporting API and advisory creation page could not be fetched; reporting remains unverified. Remote GitHub Actions results were not verified.

The operator explicitly deferred real-reviewer, native scanner, interactive approval, and private vulnerability-reporting checks until after release: “No, I'll check it myself after release.” These are deferred checks, not passes, and production acceptance remains incomplete. This decision does not resolve the dependency advisories or reserve the npm name. No publication, push, tag, or release was performed.

## Previous verification — 2026-11-06

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
