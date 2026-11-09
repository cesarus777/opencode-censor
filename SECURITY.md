# Security policy

This plugin is a permission reviewer, not an execution sandbox. No absolute safety guarantee is made. Version 0.3.0 targets OpenCode 2.2.5; host and provider acceptance testing must be completed before relying on it in production.

## Threat model

The working agent may propose destructive, deceptive or ambiguous commands. Command arguments and task history may contain prompt injections, sensitive data, arbitrary executable names or hostile shell syntax. A reviewer may hallucinate, produce malformed output, time out or fail. Multiple permission evaluations may overlap, and providers may ignore cancellation.

The trusted computing base includes OpenCode's rule evaluation, scanner and permission machinery, this plugin and its dependencies, the selected provider, installed executables, shell startup/configuration, the workspace runtime, and other loaded plugins. The reviewer does not receive execution tools, but shares the OpenCode process and native generation infrastructure. Separate model selection is not a hard isolation boundary.

## Protections

- Explicit native deny rules run before hooks and remain authoritative. The plugin also defensively leaves incoming deny events untouched.
- In-scope existing allows are immediately downgraded before asynchronous review. Any review, configuration, parsing, context or timeout error produces ask.
- Stateless candidate commands must match a closed inspection grammar and a captured complete native shell tool input. Multiple scanner fragments, absent source IDs, changed source, expired correlation and unsupported workdirs ask.
- In stateless mode, free shell programs, redirection, substitutions, command chains, network operations, installation, scripts, privilege changes, deletion and history mutation never become automatic allow, even with a malicious allow response.
- The response parser rejects extra fields, nested values, duplicate keys, invalid values, unknown decisions and ambiguous/contradictory allow explanations. Risk, reason and local policy checks are independent of confidence.
- Only commands eligible for the configured local strategy cross the provider boundary. A sensitive-data tripwire supplements the grammar. Optional context transmits fixed intent labels rather than original text or file contents.
- Per-evaluation deadlines, lifecycle cancellation and a bound of eight unsettled tasks prevent indefinite UI waiting and unbounded model requests. Late results cannot change returned effects.
- Audit file records use fixed local reason/detail codes, stages, effective settings and bounded numeric diagnostics; see [the audit reference](docs/AUDIT.md). File write failures can make counts incomplete but cannot change a permission result. Records include native session IDs and, by default, exact captured commands. Commands can contain credentials, paths and other private data. Set `logging.includeCommands: false` to omit command text; disable logging to omit all audit records. Raw history, model output and error messages are not logged.

## Opt-in stateful project review

Stateful review deliberately delegates program semantics to a generic model loop.
It has no Make/Bash interpreters, command allowlists or trusted recipe steps. This
expands the original inspection-only boundary: local policy constrains disclosure,
observable command features, source correlation, budgets, validated declarations
and evidence freshness; it cannot independently prove arbitrary programs safe.

Explicit `allowFileContents` consent permits model-requested files within configured
project-relative path scopes to reach the selected provider. Raw history and
runtime environment values remain excluded. Read/list/literal-search operations
use bounded filesystem APIs only, with no subprocesses, execution tools or working
agents. Traversal, symlinks, protected paths, invalid encoding, sensitive matches
and exceeded limits produce unavailable evidence and prevent allow. Secret
tripwires are heuristic and cannot guarantee confidential data is removed.

A final allow needs a successful referenced current full-file read, no unresolved
evidence failures, low model risk, sufficient confidence, no declared uncertainty,
and no model-declared forbidden or unknown effects. These are model declarations,
not enforcement of all transitive effects. A lying or mistaken reviewer can
misjudge a harmful eligible command. Native hard denies remain authoritative.
Use actual host isolation for filesystem/network restrictions.

All inspected file contents and visible directory inventories are rechecked, as
are native input, project-local directory identity and scanner resources. Multiple scanner fragments
are supplemental only; the captured complete command is supplied independently.
Prior findings are withheld until their evidence is freshly reacquired and matches
its fingerprints. Temporary state is bounded, expires and never caches approvals.
Audit includes session IDs and optional exact commands, but no evidence file contents or provider prose.
See [the protocol, configuration and limits](docs/STATEFUL.md).

Hybrid keeps the default stateless grammar intact and never retries an inspection
ask through project review. It requires disclosure consent because other eligible
commands may acquire evidence. `alwaysAsk` applies to both paths; forbidding reads
or process execution conservatively blocks hybrid inspections. Stateful full-file
evidence requirements apply to the project path. Inspection relies on its narrower
source/resource grammar and reviewer contract and acquires no evidence files.

Native `~` and `~/…` workdirs are rejected before any evidence or model review,
even when a literal project directory with that name exists. This avoids confusing
OpenCode 2.2.5 home expansion with project-relative filesystem resolution.
Directory identity checks include canonical project containment and every workdir
component. Evidence scopes remain rooted at the project root. Findings and file
hints are separated by workdir. A directory or input change while queued or under
review cannot reuse an allow. A final filesystem check cannot close the check/run
race; trusted native shell hooks or other plugins can still change execution input.

Project reviews queue FIFO per session with 32 global/eight per-session waiters and
eight active or unsettled tasks. Total deadlines include waiting and final checks.
Timed-out operations keep capacity and session locks until settlement; unloading
settles waiters and handles late results. These limits bound resource use, not costs
inside the provider or the native host.

## Boundaries and residual risks

An ask is not a denial: OpenCode's client must present it and the human must evaluate it. Global auto-approve, unattended policies, saved approvals and other plugins can affect permission outcomes. Keep narrow independent hard-deny rules and the baseline shell ask rule. Do not use global auto-approve with this workflow.

Inspection commands are not side-effect-free under arbitrary environments. A replaced executable, shell alias/function, startup file, Git helper/fsmonitor, hostile repository config or compromised dependency may execute code. The plugin does not inspect executable content or enforce a filesystem/network boundary. It rejects workdir symlink components and checks canonical containment and directory identity, but cannot prevent time-of-check/time-of-use changes. It does not stop sensitive command output from reaching the primary agent. Protect secrets and enforce actual isolation separately where needed.

The shell source snapshot is correlated through native tool hooks. A tool with a different schema, custom permission assertions or unavailable source information asks. Other plugins that change source after evaluation, replace native tools or overwrite permissions are trusted code and can invalidate assumptions. A plugin load failure leaves only native rules; use ask as the baseline.

The current text API has no provider-enforced system/data split or JSON-schema output parameter. Delimiters alone cannot defeat prompt injection. The independent local grammar and policy bound potential automatic approvals even when the reviewer is compromised. They do not establish command safety in an untrusted host.

The SDK's local Promise adapter currently ignores generation cancellation options. The native smoke with a controlled loopback HTTP provider observed zero provider abort events after deadlines and reload. Timed-out calls can continue incurring costs. Eight stuck tasks exhaust active review capacity until settlement or reload. Project reviews wait only within bounded queue limits and deadlines; inspection overload asks immediately. Context history is fetched locally in full because the native endpoint lacks a limit; only local scanning and transmitted labels are bounded.

The sensitive-data tripwire is heuristic. The default closed command vocabulary and label-only context avoid forwarding arbitrary supplied strings; opt-in stateful review additionally discloses selected file contents, but a user must still trust their model provider, native provider hooks/diagnostics and OpenCode configuration. Audit sinks outside this plugin may have their own retention policies. Correlation holds temporary tool input references in bounded memory until tool completion, later pruning, or unload; audit logging persists captured commands by default until the operator removes or rotates the audit file.

Only shell permission events are protected. Direct terminals, arbitrary plugin code, MCP tools, alternate execution mechanisms and permissions that OpenCode does not emit are outside scope. The plugin never calls `permission.reply`, launches a shell, or retries an execution.

## Release security status

The locked SDK dependency graph has two moderate advisories affecting transitive `glob` and `minimatch` versions. The review path does not call these libraries directly; SDK and host package-management exposure has not been ruled out. See [the dependency audit triage](docs/VERIFICATION.md#dependency-audit-triage) for affected versions, advisory links and the decision to retain the inspected SDK contract. On 2026-11-07, the operator explicitly accepted these remaining risks for release 0.1.0. Neither advisory is fixed.

The [release checklist](docs/RELEASE-CHECKLIST.md) keeps real reviewer and interactive approval acceptance open. The original 2.2.5 scanner has now been checked with process creation prevented; see the current verification record. The operator deferred these checks and private reporting verification until after the release candidate; the free-provider harness has observed safe `review_error` fallback, but real-provider acceptance remains incomplete. Credential-free smoke results establish only the scope recorded in [verification](docs/VERIFICATION.md).

## Reporting vulnerabilities

The source repository is [cesarus777/opencode-censor](https://github.com/cesarus777/opencode-censor). Use [GitHub private vulnerability reporting](https://github.com/cesarus777/opencode-censor/security/advisories/new) if the repository offers it. Availability of that route has not yet been confirmed; verification has been deferred by the operator until after release. If unavailable, contact the distributor privately to arrange a confidential channel. Do not post exploit details or credentials in [public issues](https://github.com/cesarus777/opencode-censor/issues). No verified maintainer email is supplied.

Include the plugin and OpenCode versions, sanitized configuration, expected versus observed decisions, whether another plugin or auto-approve was active, and a harmless reproduction that does not execute destructive commands. Never include real tokens or private command histories. No response SLA is claimed before maintainership is established.
