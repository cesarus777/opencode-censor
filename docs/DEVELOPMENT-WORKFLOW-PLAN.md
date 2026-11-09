# Development workflow implementation plan

Status: planned, not implemented. Recorded 2026-11-09.

The intended workflow is semi-automated development: routine inspection should
require little friction, project development commands should receive evidence-based
review, and concrete uncertainty or restricted effects should produce native
manual approval. Audit schema version 2 is implemented separately; it supplies
specific failure diagnostics for this work.

The current default stateless strategy admits only an exact inspection grammar.
Selecting permissive mode does not admit general development commands. Stateful
review supports broader commands, but currently requires a full-file read even
for inspections, rejects working directories other than the project root, and
returns `stateful_busy` for concurrent reviews in the same session. The existing
native harness replaces the shell implementation and does not verify the original
scanner contract.

Implement the following steps in order. Preserve native hard denies, non-shell
permissions, explicit file-disclosure consent, fresh source correlation, bounded
work and fail-safe decisions throughout. No reviewed command may be executed in
plugin code or automated tests. No approval cache or automatic permission replies
are introduced.

## 1. Verify and repair native scanner integration

Inspect the actual pinned OpenCode 2.2.5 implementation and declarations for the
complete tool input, scanner resources, native source identifiers and hook order.
Record findings in `docs/RESEARCH.md`; do not infer contracts from the mock host.

Add fixtures covering exact `ls` and `git status`, supported flags, unsupported
arguments, compounds, pipelines and working directories. Build a native probe that
uses the original scanner while preventing execution at a verified interception
point. Verify that interception occurs before any process creation. Replacing the
shell implementation with direct permission assertions remains useful for other
checks but cannot establish original-scanner compatibility.

If no supported interception point exists, document the restriction and keep
original-scanner acceptance open. Do not execute reviewed strings to close it.
Fix only confirmed adapter mismatches. Scanner fragments must never be used to
reconstruct complete source; any matching changes require explicit security
reasoning and regression tests.

Acceptance:

- Explain observed prompts for exact inspection commands using actual diagnostics.
- Demonstrate native source correlation and the correct inspection path through
  the original scanner, or explicitly record what remains unverified.
- Preserve ask for missing, expired, changed or ambiguous source and resource data.

## 2. Add an explicit hybrid strategy

Add `review.strategy: "hybrid"` to the configuration schema and documentation.
Keep the default stateless strategy and existing explicit strategies unchanged
initially. Provide a development configuration that explicitly selects hybrid.
Hybrid requires `review.project.allowFileContents: true` because it may enter
project evidence review.

Route requests as follows:

| Request                                                                      | Path                            |
| ---------------------------------------------------------------------------- | ------------------------------- |
| Existing eligible inspection command with matching complete source/resources | Existing stateless model review |
| Other command eligible for project review                                    | Stateful evidence review        |
| Missing source, invalid configuration or failed local restrictions           | Native manual approval          |

Preserve the inspection grammar and model review requirement. A stateless reviewer
ask, malformed response, provider error or timeout ends as ask; do not retry that
decision through the broader project strategy.

Apply applicable configured restrictions before routing, including `alwaysAsk`.
Define and test conservative enforcement of `forbiddenEffects` on the inspection
path, including configurations forbidding workspace reads or process execution.
Hybrid routing must not bypass a user's more restrictive settings. Stateless
inspection alone does not acquire project evidence or inherit the stateful
full-file-read requirement; document this intentional strategy distinction.

Acceptance:

- Eligible inspection needs no evidence file read and still needs a valid model
  decision and final local policy checks.
- Development commands can reach stateful evidence review within consented scopes.
- Both paths honor applicable restrictions, disclose only their documented inputs,
  and never use alternate-path retries to obtain approval.

## 3. Support project subdirectory working directories

Replace command-only source capture with a typed snapshot containing the complete
command and working directory, correlated with the native source key. Resolve
and validate the working directory inside the total evaluation deadline. Reject
external locations, invalid directories and symlink escapes; account for the
canonical project root rather than relying on string-prefix comparisons.

Keep evidence paths, exclusions and disclosure scopes project-root-relative.
Supply the actual project-relative working directory to the reviewer so relative
script paths and effects are interpreted in context. Include working directory
in remembered-finding identity alongside session and command. Findings from one
working directory cannot authorize or guide semantic reuse in another without
appropriate fresh evidence.

Recheck captured native input and directory identity before accepting allow.
Document remaining filesystem check/run races. An embedded `cd` is part of the
reviewed shell command, not a replacement for the native working-directory field.

Acceptance:

- Review project-local commands in directories such as `packages/app` correctly.
- Reject external directories, symlink escapes, changed directories and mutated
  native workdir fields.
- Prevent cross-directory finding reuse and keep evidence scopes rooted correctly.

## 4. Add bounded waiting for concurrent project reviews

Replace immediate same-session busy prompts with FIFO waiting per session.
Retain at most eight active or still-unsettled review tasks. Initially cap waiting
requests at 32 globally and eight per session. Preserve progress for other
sessions; a busy session must not block otherwise admissible work.

Start the total deadline at permission evaluation entry, covering source validation,
queue waiting, context, evidence, generation and final rechecks. Revalidate queued
input and eligibility before starting review. Expired waiters return ask without
starting generation. Queue overflow also returns ask with a specific audit code.

A timed-out provider or evidence operation that has not settled retains its active
capacity slot and session lock until settlement. Do not release these merely
because the permission decision timed out. Expired waiters must be removed from
queues and retain no input references unnecessarily. Unload settles pending
waiters as ask, clears queues and handles late resolutions and rejections.

Acceptance:

- Ordinary same-session concurrency waits in order rather than immediately asking.
- Queue length, active work and total waiting time remain bounded.
- Different sessions can progress independently.
- Expired waiters make zero generation calls; hung operations, overload, late
  replies, cancellation and unload cannot produce a late allow or leak capacity.

## Audit, validation and rollout

Extend audit metadata with selected review path and queue-wait duration. Retain
effective strategy, final stage/detail, exact command/session behavior and snapshot
call counts. Keep raw provider output, evidence contents and exception messages
out of logs. Update `docs/AUDIT.md`, `censor-stats` where needed, README, stateful
review documentation, examples and the security threat model.

Use deterministic reviewer responses for routing, restrictive configuration,
file-disclosure, workdir containment, evidence freshness, queue ordering/fairness,
deadlines, late results and lifecycle regression tests. Include source mutation
while queued and while reviewing. Never execute command fixtures.

Use Bun 1.3.11 or later and Node 22 or later. Run frozen installation, typecheck,
formatting, all tests, build and package validation. Inspect the actual archive and
verify isolated installation and ESM imports. Run available installed-package
native probes with execution prevented.

Record mocked tests, original-scanner verification, controlled local provider,
remote-provider and interactive-client acceptance separately in
`docs/VERIFICATION.md`. Constraints and deferred checks remain explicit. This plan
does not authorize publication, remote push or a release, and does not claim that
models or declared effects establish a sandbox.
