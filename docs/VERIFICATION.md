# Version 0.3.1 remote staging outcome — 2026-11-09

Retry commit `d2ba5e2` and annotated tag `v0.3.1` were pushed.
[Stage run 42654799430](https://github.com/cesarus777/opencode-censor/actions/runs/42654799430)
succeeded. Job step metadata confirms successful package validation, installed-package
native smoke, final archive inspection/installation, and staging the verified archive
through npm trusted publishing. Both
[main CI](https://github.com/cesarus777/opencode-censor/actions/runs/42654798107) and
[tag CI](https://github.com/cesarus777/opencode-censor/actions/runs/42654799652) passed
for the release commit. The initial failed `v0.3.0` tag remains unchanged.

After successful staging, npm still reported public version/latest 0.2.0.
**Version 0.3.1 is staged for maintainer 2FA approval and is not yet confirmed
public.** The configured staging workflow does not bypass that approval step.
Remote-provider, interactive-client and private reporting acceptance remain
outstanding; the controlled native probe never executes reviewed strings.

# Version 0.3.1 release retry — 2026-11-09

Commit `eda9919` and annotated tag `v0.3.0` were pushed for the authorized release.
[Main CI](https://github.com/cesarus777/opencode-censor/actions/runs/42648205298)
and [tag CI](https://github.com/cesarus777/opencode-censor/actions/runs/42648205165)
passed. [Npm staging run 42648205386](https://github.com/cesarus777/opencode-censor/actions/runs/42648205386)
failed in package validation: 201 tests passed and the unload test failed because
its reviewer completion callback had not yet been assigned. No npm staging step ran.

The GitHub log API returned 403 without Actions authentication; the operator
supplied the failing test summary. The same `finish is not a function` failure was
reproduced locally on the first single-CPU adapter test run, after 20 normal suite
runs passed. Async workdir validation invalidated the old 1 ms startup assumption.
Unload, pending source mutation and native-deny tests now await explicit reviewer
readiness. Permission behavior is unchanged by this test-only follow-up.

The failed tag is preserved. Version 0.3.1 will retry the existing verified archive
staging workflow; maintainer npm 2FA approval is still required before publication.
Retry validation passed with Bun 1.3.11 and Node 26.11.1: frozen installation,
typecheck, formatting, 202 tests (634 assertions) and build. All 30 single-CPU
adapter repetitions passed after the synchronization fix. Sandboxed npm pack
again returned no report; the escalated standalone check passed all 74 archive
files, isolated installation and Bun/Node ESM imports. The 0.3.1 installed-package
native probe passed, including all 13 original-scanner fixtures intercepted before
process creation and generic evidence review; provider abort observations were zero.
Remote staging will be recorded after completion.

# Version 0.3.0 release preflight — 2026-11-09

The operator authorized resolving the home-workdir review finding, updating
release documentation, staging and committing the implementation, and running
release deployment. Version 0.3.0 includes hybrid routing, project-local workdirs,
bounded review queues and audit diagnostics from the development workflow work.

The home-expansion finding is fixed by rejecting native `~` and `~/…` workdirs
before directory resolution, evidence acquisition or generation. Tests create a
literal project `~/app` directory and cover stateless, stateful and hybrid review,
explicit relative literal paths, and workdir mutation while review is pending.
The actual pinned 2.2.5 `FileAccess.resolve` implementation was reinspected; see
[the research note](RESEARCH.md#native-home-relative-workdirs--2026-11-09).

Registry preflight confirms public package version/latest 0.2.0 and maintainer
`cesarus777`. Version 0.3.0 is prepared for the existing tag-triggered **Stage on
npm** workflow, which requires maintainer 2FA approval before publication. Release
validation passed with Bun 1.3.11 and Node 26.11.1: frozen installation,
typecheck, formatting, 202 tests (634 assertions), and build. Sandboxed npm pack
returned no report; the separately escalated package check passed inspection of
74 archive files, isolated installation with lifecycle scripts disabled, Bun/Node
ESM imports and the installed statistics CLI. The installed-package native probe
passed with the controlled loopback provider, generic evidence review and all 13
original-scanner fixtures intercepted before process creation. Provider abort
observations were zero; no reviewed command was executed. Remote release staging
will be recorded after completion.
Dependencies are unchanged; the previously accepted transitive dependency
advisories remain documented. Remote-provider, interactive-client and private
reporting acceptance remain outstanding. The unrelated screenshot and local audit
file are excluded from staging and release artifacts.

# Development workflow — 2026-11-09

Implemented locally; no publication, push, tag or release was performed. The default
strategy remains stateless. Hybrid requires explicit file-disclosure consent.
Development configuration is in `examples/opencode-development.jsonc`.

Environment: Bun 1.3.11 (explicit runtime path; system Bun 1.1.34 was not used),
Node 26.11.1, pinned OpenCode/SDK 2.2.5. Frozen installation passed with no dependency
changes. Typecheck, formatting, all 199 deterministic tests (599 assertions) and
build passed. The combined check stopped at sandboxed npm pack, which returned no
report. The separately escalated package check passed: 74 archive files inspected,
isolated installation with lifecycle scripts disabled, and public ESM imports in
Bun and Node. The final native rerun also required escalation after the sandbox
prevented the host version preflight; that restricted attempt is not a pass.

Deterministic tests cover routing without alternate-path retry, restrictive hybrid
settings, disclosure consent, workdir canonical containment and symlink rejection,
changed native inputs/resources/identifiers while queued and reviewing, directory
replacement, workdir-scoped findings, FIFO progress across sessions, global/session
queue overflow, entry deadlines, zero-generation expiry, hung evidence/provider
capacity retention, unload and late settlement. Reviewed strings remain inert.

The installed-archive native probe passed with a controlled loopback HTTP provider.
The main phase retains the inert replacement shell and checks source hooks,
allow/ask/error/hard deny, timeout/late replies, active capacity and lifecycle,
plus the generic evidence loop. A separate phase preserves the original native
shell implementation and scanner, then forces native deny in a final permission
evaluation hook. Inspection of the actual 2.2.5 binary confirms that this assertion
must succeed before `Shell.create` enters `spawner.spawn`. No reviewed command was
executed and no pending permission was answered.

All 13 original-scanner fixtures passed: exact `ls`/`git status`, supported flags,
unsupported arguments, compounds, pipelines and `packages/app` workdirs. Source IDs
matched the native tool hook. Exact eligible inspections used one reviewer call;
unsupported arguments yielded `command_outside_grammar`, and compounds/pipelines
yielded `multiple_resources` with zero calls. No scanner adapter mismatch was found.
Provider abort observations remained zero; cancellation/cost limits are unchanged.

| Acceptance category                           | Status and scope                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| Deterministic unit/security/mock host         | Passed: 199 tests / 599 assertions.                                                 |
| Archive / isolated install / Bun and Node ESM | Passed: 74 archive files inspected, isolated installation and both runtime imports. |
| Original OpenCode 2.2.5 scanner               | Passed with native deny preventing process creation; no real shell execution.       |
| Controlled local reviewer provider            | Passed through native HTTP generation with synthetic credentials.                   |
| Remote provider / stateful real reviewer      | Not run for this change; earlier safe provider failures are not acceptance.         |
| Interactive client approval / real execution  | Not run; remains a separate deployment check.                                       |
| Remote CI                                     | Not run.                                                                            |

The following records describe earlier versions and their historical acceptance
scope; the original-scanner result above supersedes their deferred-scanner status
for the pinned local fixture set only.

# Development workflow plan documentation — 2026-11-09

Added `docs/DEVELOPMENT-WORKFLOW-PLAN.md` and a README link. The plan covers
original-scanner verification, explicit hybrid review, project subdirectory
support and bounded review waiting, with security constraints and acceptance
criteria. These features remain unimplemented. Formatting and diff checks passed;
this documentation step did not change the previously tested audit implementation.
The 173-test and package results below describe that implementation before the
plan document was added. No native/provider checks, publication or push were
performed during this documentation step.

# Structured audit diagnostics — 2026-11-08

Implemented audit schema version 2 with effective strategy/mode, initial scanner
resource count, stage, specific local detail codes, validated confidence and an
always-present generation-call count. Exact commands and native sessions remain
as described below. Source, grammar, provider/context, evidence, admission and
recheck failures are distinguishable without expanding approval eligibility.
Call counts are snapshots at settlement, including failures and timeouts; late
responses cannot alter records. Final input rechecks retain validated reviewer
metadata while preserving the fail-safe ask decision.

`censor-stats` now groups reasons/details and reports known reviewer reach,
separately counting legacy unknowns. The existing 44-record audit file was read
without modification: 44 policy asks and 44 records with unknown reach/details.
New deterministic tests cover scanner/resource distinctions, native missing,
expired and invalid captures/workdirs, context versus provider failure, timeout
snapshots, confidence, recheck metadata retention, stateful diagnostics, malformed
counts and mixed-version statistics. All command fixtures remain inert strings.

Bun 1.3.11 frozen installation, typecheck, formatting, 173 tests (490 assertions)
and build passed with Node 26.11.1. The sandboxed combined check failed only at
package validation because npm produced no pack report. The separate package
check outside the sandbox passed: 69 archive files inspected, isolated install
with lifecycle scripts disabled, and Bun/Node ESM imports. Original native
scanner, remote-provider and interactive-client acceptance were not run for this
change. No publication, commit or remote push was performed.

# Audit command and session diagnostics — 2026-11-08

Audit records now include the native session ID and, by default, the exact captured
shell command. `logging.includeCommands: false` omits command text; logging can
still be disabled entirely. Missing complete source is never reconstructed from
scanner fragments. Invalid configuration omits commands. This explicitly expands
the audit privacy boundary: commands can contain credentials and private paths.
Permission eligibility, reviewer disclosure and native deny handling are unchanged.

Bun 1.3.11 frozen installation, typecheck, formatting, 159 deterministic tests
(453 assertions) and build passed with Node 26.11.1. New tests cover exact
multiline command round trips, explicit command omission and missing full source
with session attribution. No reviewed command was executed. The sandboxed package
check failed with no npm pack report; the outside-sandbox check passed archive
inspection (65 files), isolated installation with lifecycle scripts disabled and
Bun/Node ESM imports. Native scanner, remote provider and interactive client checks
were not run for this change. No publication or remote push was performed.

# Version 0.2.0 remote staging outcome — 2026-11-08

Release commit `e6cf677` was pushed to `origin/main` and annotated tag `v0.2.0`
was pushed to trigger staging. [Stage run 42415788046](https://github.com/cesarus777/opencode-censor/actions/runs/42415788046)
completed successfully, including full package validation, installed-package native
smoke, final archive inspection/installation and `npm stage publish` through
trusted publishing. Both [main CI](https://github.com/cesarus777/opencode-censor/actions/runs/42415758540)
and [tag CI](https://github.com/cesarus777/opencode-censor/actions/runs/42415788118)
completed successfully.

After staging, the public npm registry still reported version and `latest` 0.1.1.
Version 0.2.0 is staged for maintainer approval; it is not yet confirmed public.
The package's configured release process requires npm maintainer 2FA approval.
The staged archive includes the preflight record below; this remote outcome was
recorded afterward. Failed free-provider acceptance and deferred deployment checks
remain outstanding. No GitHub Release object was created; the pushed tag drove
the repository's npm deployment workflow.

# Version 0.2.0 release preflight — 2026-11-08

The operator authorized documentation updates, staging and committing project
changes, remote push and release deployment. Version 0.2.0 includes the previously
committed stateful reviewer and custom instructions plus the new free-provider
integration harness. Current install examples, security status, stateful guide,
changelog and release checklist were reviewed and updated. Historical verification
records retain their original version numbers and results.

Bun 1.3.11 and Node 26.11.1: frozen installation, strict typecheck, formatting,
156 deterministic tests (440 assertions), build and workflow syntax validation
passed. The full check stopped at sandboxed npm pack, which returned no report;
separate outside-sandbox package validation passed, inspecting 65 archive files,
installing with lifecycle scripts disabled and importing through Bun and Node.
The installed-archive native smoke passed outside the sandbox with OpenCode 2.2.5,
covering allow/ask/error/native deny, source hooks, timeout/late reply, eight-review
capacity under ten concurrent requests, reload cleanup and generic evidence
allow/ask/missing-file cases. Provider abort observations remained zero.

npm registry metadata confirmed `cesarus777` maintains the scoped package and
`latest` was 0.1.1 before release. The remote main branch was `636d577` and
`v0.2.0` was absent. Dependencies are unchanged; the previously accepted moderate
advisories remain documented. Real free-provider acceptance remains incomplete
(`review_error` fallback); original-scanner, interactive-client and remote stateful
acceptance remain outstanding. No production acceptance is claimed.

The release is intended for the existing tag-triggered staging workflow, followed
by npm maintainer 2FA approval. At this preflight record, the release commit, tag,
remote staging and npm publication have not yet completed. The unrelated local
screenshot and audit file are excluded from staging and release artifacts.

# Free-provider integration harness — 2026-11-08

Added an opt-in `test:live:free` check and manual GitHub workflow for an explicitly
selected built-in `opencode` reviewer. Selection tests reject missing or duplicate
models, other providers, disabled/deprecated/nontext models, missing pricing,
paid tiers and cache charges. The existing deterministic native suite is unchanged.
The new remote suite currently covers stateless review only; remote stateful,
original scanner and interactive UI acceptance remain outstanding.

Local validation used Bun 1.3.11 and Node 26.11.1. Frozen installation,
typecheck, formatting, 156 deterministic tests (440 assertions), and build passed.
The live attempt inspected and installed the actual archive and passed its Bun/Node
imports. Outside the sandbox, host 2.2.5 reported `opencode/big-pickle` with
explicit zero pricing. Installed-plugin loading, missing-source ask, local-policy
ask and native deny bypass passed. The eligible inspection review produced
`ask` with fixed reason `review_error` after 513 ms; a native pending permission
was observed. This is **incomplete real-provider acceptance**, not a pass. No
provider response or host diagnostics were retained, and the underlying provider
error was not diagnosed. No reviewed command executed or permission was answered.

A repeat with the final harness again produced `review_error` (505 ms),
confirmed the native pending permission and passed reload cleanup. Actionlint
validated the manual workflow; it has not run remotely.

The initial `bun run test:live:free` attempt resolved nested Bun from PATH to
system 1.1.34 and failed the native version preflight inside the sandbox. It is
not a pass. Subsequent checks invoked Bun 1.3.11 directly. No remote workflow,
publication, push or release was performed.

# Generic project evidence loop — 2026-11-07

Replaced the development Make/Bash verifier with a generic read/list/literal-search
review protocol. No command-specific parsing, exact command allowlists, phony
requirements or trusted-step grants remain. Stateful mode delegates execution
semantics to the model; local policy constrains source correlation, disclosure,
observable command features, budgets, schema, declared effects and freshness.
Stateless inspection remains unchanged and is the default. The two reported Make
mismatches are retained as inert complete-command/full-file evidence fixtures;
these tests do not claim local code independently proves arbitrary Make behavior.

The evidence source uses bounded filesystem APIs, protected-path and symlink checks,
full UTF-8 reads, explicit unavailable results, and file/directory fingerprints.
All observations are rechecked before accepting the result. Session findings are
bounded/expiring, local-command-hash-specific and withheld until referenced evidence
is freshly reacquired. Raw command history, provider prose and file contents are
not stored between evaluations or logged. No reviewed command is executed.

Bun 1.3.11 frozen installation, strict typecheck, formatting, 152 deterministic
unit/mock-host tests (426 assertions), and build passed with Node 26.11.1.
The fixtures cover Ninja, CMake, Meson, Bazel, Python, Ruby and Node through one
protocol; these are mocked judgment/transport tests, not executions or language
semantic acceptance. Coverage includes duplicate/escaped JSON fields, invalid
schemas/references, missing/sensitive/oversized evidence, scope and symlink escapes,
search/traversal budgets, stale files/inventories, declared restrictions, session
isolation/expiry/eviction, command-specific findings, concurrent reviews, capacity,
late rejection, unload and native input/workdir rechecks.

The 65-file npm archive passed content inspection, isolated installation with
lifecycle scripts disabled, and Bun/Node ESM imports. The installed-archive native
OpenCode 2.2.5 probe passed outside the sandbox with a controlled loopback provider
and inert replacement shell: existing allow/ask/error/deny, timeout, late replies,
eight-of-ten admission and reload checks, plus generic two-call evidence/final
allow, model ask, unavailable-file fallback, and a stateful inspection command.
Provider abort observations remained zero. The sandboxed attempt failed the native
version preflight, consistent with the host subprocess restriction; it is not a pass.

Original shell scanner/executor, remote reviewer quality and interactive-client
acceptance remain untested. No provider credentials were accessed. No dependency,
publication, push, tag or release was performed during implementation. Commit
creation is tracked separately by repository history.

# Superseded Make/Bash subset verification — 2026-11-07

Implemented `review.strategy: stateful` using the existing native stateless text
API, an injectable bounded filesystem inspector, and temporary per-session
operation/decision/risk findings. Explicit `allowFileContents` consent and exact
entrypoint/file lists control disclosure. Stateless inspection stays the default.
No reviewed commands were executed, no provider agent was created, and no approval
cache or permission replies were added.

The local grammar admits a restricted Make/Bash subset. GNU Make's implicit-rule
and makefile-remaking behavior requires phony guards for reachable targets and all
three default Makefile names. Explicit trusted steps delegate trust to selected
executables and their transitive code; this is a documented expansion of the
original read-only boundary, not a claim of complete script safety. Model output
cannot expand these local limits. Source and project evidence are rechecked after
review; raw file contents and provider prose never enter session findings or audit.

Bun 1.3.11 frozen installation, typecheck, formatting, 148 deterministic tests
(346 assertions), and build passed. Tests cover static dependency closure,
unsupported syntax, implicit-rule guards, sensitive matches, file-size limits,
symlinks, changed files, model uncertainty, exact trusted steps, bounded traversal,
session expiry/eviction/isolation, overlapping reviews, late rejection, unload,
sanitized audit records, and adapter workdir/source rechecks.
The 59-file npm archive passed content inspection, installation with lifecycle
scripts disabled, and standalone Bun/Node imports (Node 26.11.1).

Native host probing was not rerun for this change. Original built-in scanner,
remote provider review quality, and interactive native-client acceptance of the
new Make/Bash entrypoints remain untested. Mock-host checks are not evidence of
those behaviors. No dependency, publication, push, tag or release change was made.

# Custom reviewer instructions and decision diagnostics — 2026-11-07

Added bounded optional `systemPrompt` instructions alongside the existing caution
modes. The SDK still receives one prompt string; eligibility and the automatic
approval grammar are unchanged. Audit records expose validated reviewer decision
and risk enums, never raw replies or reasons. Invalid replies now have the fixed
`invalid_review_response` code, separate from provider/context failures.

Bun 1.3.11 frozen installation, typecheck, formatting, 104 deterministic tests
(224 assertions), build, and archive inspection/standalone installation passed.
The 54-file archive imported successfully in Bun and Node with installation
lifecycle scripts disabled. Tests cover custom instructions that attempt
to broaden approval, invalid prompt configuration, sanitized reviewer metadata,
and malformed reply diagnostics. No remote reviewer or interactive client test
was run for this change. The operator-supplied repository audit contained only
local `policy_requires_review` outcomes; those records do not establish model calls.

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
