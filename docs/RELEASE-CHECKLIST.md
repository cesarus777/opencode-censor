# Version 0.3.1 acceptance supplement

- [x] Reproduce the 0.3.0 staging test failure on a single CPU and replace fixed startup sleeps with explicit reviewer readiness.
- [x] Validate the retry archive and native probe locally: 202 tests, 30 single-CPU adapter repetitions, 74 archive files, isolated imports and the installed native probe.
- [x] Commit and deploy v0.3.1 (`d2ba5e2`); release main/tag CI passed.
- [x] Verify successful remote npm staging: run 42654799430 passed, including the npm trusted-publishing step. Public latest remains 0.2.0 until maintainer approval.
- [ ] Maintainer approves the staged package with npm 2FA and public availability is confirmed.

The failed `v0.3.0` tag remains unchanged. Its main/tag CI passed, but staging
stopped during validation and did not reach npm. All deferred acceptance below
remains outstanding.

# Version 0.3.0 acceptance supplement

- [x] Reject native home-relative workdirs before review; cover literal `~/app` directories and pending workdir mutation.
- [x] Retain hybrid routing, workdir containment, bounded FIFO queues and fixed audit diagnostics from the development workflow implementation.
- [x] Confirm public npm package owner (`cesarus777`) and latest version (0.2.0) before staging 0.3.0.
- [x] Complete final local package validation (202 tests; archive inspection and isolated Bun/Node imports) and installed-archive native probe for 0.3.0.
- [x] Commit and push the reviewed 0.3.0 source and trigger staging; CI passed, but staging failed at the lifecycle test race and is retried in 0.3.1.
- [ ] Maintainer approves the staged package with npm 2FA and public 0.3.0 availability is confirmed.

Remote-provider, interactive-client and private reporting acceptance remain
outstanding as documented below. Original-scanner acceptance uses interception
before process creation and does not execute reviewed strings.

# Version 0.2.0 acceptance supplement

This release includes opt-in generic stateful review, custom reviewer instructions
and the free-provider integration harness. Stateless inspection remains the default.
Current evidence is recorded in [VERIFICATION.md](VERIFICATION.md); the 0.1.0
checklist below is historical and does not establish acceptance of this release.

- [x] Deterministic generic evidence-loop, protocol and free-model selection tests pass.
- [x] Installed-package native probe covers generic allow, model ask, unavailable
      evidence and stateful inspection, with a controlled provider and inert shell.
- [x] Implement a separate opt-in built-in free-provider harness and manual workflow.
- [ ] Complete real-provider acceptance: `opencode/big-pickle` returned safe
      `review_error` fallback; no real-model automatic allow has been verified.
- [ ] Validate real reviewer judgment for intended build tools and languages.
- [ ] Validate original scanner/source behavior and interactive approval on the
      intended deployment and plugin combination.
- [x] Verify version 0.2.0 archive installation/imports and package ownership.
- [x] Verify remote staging outcome: run 42415788046 succeeded; main/tag CI passed.
- [ ] Approve the staged package on npm with maintainer 2FA and verify publication.

`bun run test:live` uses a loopback mock provider. `bun run test:live:free`
requires an explicitly selected built-in model with nonempty all-zero catalog
pricing; it uses synthetic input and an inert shell. Both leave the original
scanner and interactive acceptance untested. The operator authorized committing,
pushing and releasing this tree on 2026-11-08 with these outstanding checks
reported explicitly; production acceptance remains incomplete.

# First release acceptance checklist

Target: `@cesarus777/opencode-censor@0.1.0`, OpenCode and `@opencode/plugin` **2.2.5**.
This checklist defines acceptance; unchecked items are release blockers unless explicitly deferred below, and are never implied passes. Record date, exact versions, results and restrictions in [VERIFICATION.md](VERIFICATION.md).

The operator authorized migrating publication to `@cesarus777/opencode-censor@0.1.0` and deprecating the unscoped package with a migration notice after the scoped package is verified. The same implementation, dependency-risk acceptance and deferred manual checks apply. The earlier unscoped publication is historical evidence; scoped archive installation and native smoke must pass separately. Configure npm trusted publishing on the scoped package before future tag-triggered releases.

On 2026-11-07, the operator deferred real-reviewer, native scanner, interactive approval, and private vulnerability-reporting checks until after release. Those items remain unchecked for tracking; this exception permits their deferral for the release candidate and does not establish production acceptance. The operator subsequently accepted the two documented moderate dependency advisories and explicitly authorized npm publication of `opencode-censor@0.1.0`. Remote CI remains unverified. npm authentication confirms `cesarus777` and the package lookup returns E404. See the latest [publication preflight](VERIFICATION.md#authorized-publication-preflight--2026-11-07).

## Reproducible build and artifact

- [x] Verify Bun >=1.3.11 and Node >=22; install with `bun install --frozen-lockfile`.
- [x] Pass typecheck, formatting, deterministic tests, build and `test:package` against the final tree.
- [x] Inspect the actual npm archive: compiled exports/declarations, license, security policy, changelog, examples and release documentation; exclude source tests, credentials, local configuration and dependencies.
- [x] Install that archive outside the checkout and import its public export in Bun and Node.
- [x] Audit the locked dependency graph; triage advisories and record remaining supply-chain risks. Two moderate transitive advisories remain documented in VERIFICATION.md; a completed audit is not acceptance of those findings.
- [x] Resolve the dependency advisories or obtain explicit maintainer acceptance of the remaining risk.

  On 2026-11-07, the operator reversed the earlier blocking decision and explicitly accepted the two documented moderate transitive advisories for 0.1.0. The advisories remain unfixed; this is risk acceptance, not remediation.

- [x] Confirm repository, homepage and issue metadata against the supplied repository and Git origin.
- [ ] Enable and privately test the maintainer's vulnerability reporting route.

## Credential-free native smoke

Run `OPENCODE_BIN=/absolute/path/to/opencode bun run test:live` after building. The harness requires exactly host 2.2.5 and loopback/subprocess access, installs the archive outside the checkout, uses an isolated HOME and synthetic credentials, and replaces shell execution with permission assertions. It never executes reviewed strings or approves a pending request.

- [x] Native host loads the installed package and registers the hooks.
- [x] Native tool source correlates with captured full input; valid local provider output allows the inert tool.
- [x] Missing source and out-of-policy syntax ask; reviewer ask and provider failure create pending native requests.
- [x] Explicit deny skips the review hook and provider.
- [x] Deadline produces ask; late allow cannot remove the pending request or complete the inert tool.
- [x] Ten concurrent requests admit only eight unsettled reviews; overload asks immediately.
- [x] Reload invokes cleanup while reviews are pending; deterministic tests separately prove completed-source removal and that late completion cannot mutate an unloaded gate.
- [x] Record cancellation observations. SDK 2.2.5 ignores Promise generation request options; provider resource cancellation is not guaranteed.
- [ ] Run the pinned native smoke job in GitHub Actions. A local pass does not establish a CI pass.

## Deployment acceptance with a human and real reviewers

The main inert-tool phase replaces the native scanner/executor; a separate original-scanner phase now forces native deny after evaluation and before process creation. The loopback provider replaces the remote service. Deployment checks below remain distinct from this controlled acceptance. Never add actual command execution to automated security tests.

- [ ] Connect the intended real reviewer through OpenCode using the operator's credentials; record provider/model identifiers and version without secrets. Use a model explicitly separate from the working agent selection.
- [ ] With baseline shell ask and global auto-approve disabled, manually request exact `pwd`. Verify native built-in shell source/scanner compatibility, actual reviewer generation and execution without a prompt.
- [ ] Manually request harmless `printf censor-smoke`; observe a visible native approval prompt, reject it and verify no execution. Test manual approval separately with a harmless command.
- [ ] Configure an unavailable reviewer and a slow reviewer; verify visible ask fallback and that late responses do not dismiss it.
- [ ] Verify a harmless explicit hard-deny resource blocks without model generation. Test the actual combination/order of deployed plugins.
- [ ] Repeat concurrent requests and reload with the real provider; document requests that continue billing after timeout/unload.

## Publication authorization

- [x] Confirm npm account ownership and package-name availability immediately before publication. Authenticated as `cesarus777`; preflight package lookup returned E404. Publication succeeded, and registry metadata confirms `cesarus777` maintains `opencode-censor@0.1.0` with the tested archive checksum.
- [x] Resolve or explicitly accept outstanding acceptance blockers; do not describe partial acceptance as production readiness. Dependency risks accepted; manual checks deferred; remote CI unverified.
- [x] Obtain explicit user authorization before npm publication. The operator authorized publishing `opencode-censor@0.1.0` to npm and subsequently authorized committing and pushing the release documentation and workflow. At that historical release, tags and GitHub releases were outside the authorization.
