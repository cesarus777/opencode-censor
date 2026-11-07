# Security policy

This plugin is a permission reviewer, not an execution sandbox. No absolute safety guarantee is made. Version 0.1.0 is an initial release candidate targeting OpenCode 2.2.5; host and provider acceptance testing must be completed before relying on it in production.

## Threat model

The working agent may propose destructive, deceptive or ambiguous commands. Command arguments and task history may contain prompt injections, sensitive data, arbitrary executable names or hostile shell syntax. A reviewer may hallucinate, produce malformed output, time out or fail. Multiple permission evaluations may overlap, and providers may ignore cancellation.

The trusted computing base includes OpenCode's rule evaluation, scanner and permission machinery, this plugin and its dependencies, the selected provider, installed executables, shell startup/configuration, the workspace runtime, and other loaded plugins. The reviewer does not receive execution tools, but shares the OpenCode process and native generation infrastructure. Separate model selection is not a hard isolation boundary.

## Protections

- Explicit native deny rules run before hooks and remain authoritative. The plugin also defensively leaves incoming deny events untouched.
- In-scope existing allows are immediately downgraded before asynchronous review. Any review, configuration, parsing, context or timeout error produces ask.
- Candidate commands must match a closed inspection grammar and a captured complete native shell tool input. Multiple scanner fragments, absent source IDs, changed source, expired correlation and unsupported workdirs ask.
- Free shell programs, redirection, substitutions, command chains, network operations, installation, scripts, privilege changes, deletion and history mutation never become automatic allow, even with a malicious allow response.
- The response parser rejects extra fields, nested values, duplicate keys, invalid values, unknown decisions and ambiguous/contradictory allow explanations. Risk, reason and local policy checks are independent of confidence.
- Only eligible commands cross the provider boundary. A sensitive-data tripwire supplements the grammar. Optional context transmits fixed intent labels rather than original text or file contents.
- Per-evaluation deadlines, lifecycle cancellation and a bound of eight unsettled tasks prevent indefinite UI waiting and unbounded model requests. Late results cannot change returned effects.
- Audit file records use fixed local reason codes. File write failures can make counts incomplete but cannot change a permission result. No commands, histories, model output, raw error messages, credentials or analytics are logged by this plugin.

## Boundaries and residual risks

An ask is not a denial: OpenCode's client must present it and the human must evaluate it. Global auto-approve, unattended policies, saved approvals and other plugins can affect permission outcomes. Keep narrow independent hard-deny rules and the baseline shell ask rule. Do not use global auto-approve with this workflow.

Inspection commands are not side-effect-free under arbitrary environments. A replaced executable, shell alias/function, startup file, Git helper/fsmonitor, hostile repository config or compromised dependency may execute code. The plugin does not inspect executable content or enforce a filesystem/network boundary. It does not resolve workdir symlinks or prevent time-of-check/time-of-use changes. It does not stop sensitive command output from reaching the primary agent. Protect secrets and enforce actual isolation separately where needed.

The shell source snapshot is correlated through native tool hooks. A tool with a different schema, custom permission assertions or unavailable source information asks. Other plugins that change source after evaluation, replace native tools or overwrite permissions are trusted code and can invalidate assumptions. A plugin load failure leaves only native rules; use ask as the baseline.

The current text API has no provider-enforced system/data split or JSON-schema output parameter. Delimiters alone cannot defeat prompt injection. The independent local grammar and policy bound potential automatic approvals even when the reviewer is compromised. They do not establish command safety in an untrusted host.

The SDK's local Promise adapter currently ignores generation cancellation options. The native smoke with a controlled loopback HTTP provider observed zero provider abort events after deadlines and reload. Timed-out calls can continue incurring costs. Eight stuck calls exhaust review capacity until reload; further requests ask rather than opening more calls. Context history is fetched locally in full because the native endpoint lacks a limit; only local scanning and transmitted labels are bounded.

The sensitive-data tripwire is heuristic. The closed command vocabulary and label-only context avoid forwarding arbitrary supplied strings, but a user must still trust their model provider, native provider hooks/diagnostics and OpenCode configuration. Audit sinks outside this plugin may have their own retention policies. Correlation holds temporary tool input references in bounded memory until tool completion, later pruning, or unload; no command history is persisted by the plugin.

Only shell permission events are protected. Direct terminals, arbitrary plugin code, MCP tools, alternate execution mechanisms and permissions that OpenCode does not emit are outside scope. The plugin never calls `permission.reply`, launches a shell, or retries an execution.

## Release security status

The locked SDK dependency graph has two moderate advisories affecting transitive `glob` and `minimatch` versions. The review path does not call these libraries directly; SDK and host package-management exposure has not been ruled out. See [the dependency audit triage](docs/VERIFICATION.md#dependency-audit-triage) for affected versions, advisory links and the decision to retain the inspected SDK contract. On 2026-11-07, the operator explicitly accepted these remaining risks for release 0.1.0. Neither advisory is fixed.

The [release checklist](docs/RELEASE-CHECKLIST.md) also keeps real reviewer, native scanner and interactive approval acceptance open. The operator deferred these checks and private reporting verification until after the release candidate; none is recorded as passed. Credential-free smoke results establish only the scope recorded in [verification](docs/VERIFICATION.md).

## Reporting vulnerabilities

The source repository is [cesarus777/opencode-censor](https://github.com/cesarus777/opencode-censor). Use [GitHub private vulnerability reporting](https://github.com/cesarus777/opencode-censor/security/advisories/new) if the repository offers it. Availability of that route has not yet been confirmed; verification has been deferred by the operator until after release. If unavailable, contact the distributor privately to arrange a confidential channel. Do not post exploit details or credentials in [public issues](https://github.com/cesarus777/opencode-censor/issues). No verified maintainer email is supplied.

Include the plugin and OpenCode versions, sanitized configuration, expected versus observed decisions, whether another plugin or auto-approve was active, and a harmless reproduction that does not execute destructive commands. Never include real tokens or private command histories. No response SLA is claimed before maintainership is established.
