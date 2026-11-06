# First release acceptance checklist

Target: `opencode-censor@0.1.0`, OpenCode and `@opencode/plugin` **2.2.5**.
This checklist defines acceptance; unchecked items are release blockers unless explicitly deferred below, and are never implied passes. Record date, exact versions, results and restrictions in [VERIFICATION.md](VERIFICATION.md).

On 2026-11-07, the operator deferred real-reviewer, native scanner, interactive approval, and private vulnerability-reporting checks until after release. Those items remain unchecked for tracking; this exception permits their deferral for the release candidate and does not establish production acceptance. Dependency-risk acceptance remains unresolved. npm authentication confirms `cesarus777` and the package lookup returns E404; availability must be checked again immediately before publication. See the latest [readiness recheck](VERIFICATION.md#release-readiness-recheck--2026-11-07).

## Reproducible build and artifact

- [x] Verify Bun >=1.3.11 and Node >=22; install with `bun install --frozen-lockfile`.
- [x] Pass typecheck, formatting, deterministic tests, build and `test:package` against the final tree.
- [x] Inspect the actual npm archive: compiled exports/declarations, license, security policy, changelog, examples and release documentation; exclude source tests, credentials, local configuration and dependencies.
- [x] Install that archive outside the checkout and import its public export in Bun and Node.
- [x] Audit the locked dependency graph; triage advisories and record remaining supply-chain risks. Two moderate transitive advisories remain documented in VERIFICATION.md; a completed audit is not acceptance of those findings.
- [ ] Resolve the dependency advisories or obtain explicit maintainer acceptance of the remaining risk.

  On 2026-11-07, the operator chose “Keep release blocked pending a dependency fix.” Risk acceptance is not granted; publication must wait for a validated dependency fix.

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

The inert tool replaces the native scanner/executor and the loopback provider replaces the remote service. Those substitutions leave the following checks mandatory on a trusted deployment host. Never add actual command execution to automated security tests.

- [ ] Connect the intended real reviewer through OpenCode using the operator's credentials; record provider/model identifiers and version without secrets. Use a model explicitly separate from the working agent selection.
- [ ] With baseline shell ask and global auto-approve disabled, manually request exact `pwd`. Verify native built-in shell source/scanner compatibility, actual reviewer generation and execution without a prompt.
- [ ] Manually request harmless `printf censor-smoke`; observe a visible native approval prompt, reject it and verify no execution. Test manual approval separately with a harmless command.
- [ ] Configure an unavailable reviewer and a slow reviewer; verify visible ask fallback and that late responses do not dismiss it.
- [ ] Verify a harmless explicit hard-deny resource blocks without model generation. Test the actual combination/order of deployed plugins.
- [ ] Repeat concurrent requests and reload with the real provider; document requests that continue billing after timeout/unload.

## Publication authorization

- [ ] Confirm npm account ownership and package-name availability immediately before publication. Availability alone is not ownership.
- [ ] Resolve or explicitly accept outstanding acceptance blockers; do not describe partial acceptance as production readiness.
- [ ] Obtain explicit user authorization before npm publication, remote push, tags or a GitHub release. This task authorizes none of those actions.
