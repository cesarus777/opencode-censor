# OpenCode V2 API research

Inspected 2026-11-06. Registry `@opencode/plugin` latest was **2.2.5**. Installed the actual npm package and compiled against its declarations, rather than declaring a substitute SDK. The existing host reported 2.1.2; a separate 2.2.5 binary was installed under `/tmp` for smoke testing.

Primary documentation:

- [Plugin packaging and loading](https://opencode.ai/v2/docs/build/plugins/)
- [Server plugin API](https://opencode.ai/v2/docs/build/plugins/server/)
- [V2 permissions and shell resources](https://opencode.ai/v2/docs/permissions/)
- [Configuration locations and precedence](https://opencode.ai/v2/docs/config/)
- [Native shell tool behavior](https://opencode.ai/v2/docs/tools/)

The current [Promise context source](https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/promise/plugin.ts), [permission contract](https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/promise/permission.ts), [tool hook contract](https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/promise/tool.ts) and [adapter implementation](https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/promise/adapter.ts) were inspected alongside the installed 2.2.5 distribution. These upstream development links move; `bun.lock` pins the actual dependency artifacts used here. Some cached upstream tool-source tree links were stale/404, so no internal scanner metadata contract was inferred from them.

## Contracts used

`Plugin.define` accepts an id and setup function. Setup receives native options and can return async cleanup. Hook registration returns an object with async `dispose()`.

Permission evaluation exposes readonly session ID, optional agent, action, resource array, optional generic metadata and tool source, plus mutable effect and optional message. The source includes tool message and call identifiers. The hook runs after configured rules, before execution or publishing a request. It handles allow/ask; explicit configured deny skips it. Its message is used in escalated prompts/denials. The public SDK does not promise a full shell script in metadata.

Shell resources are scanner-produced strings; compounds may yield several. Consequently resources alone cannot establish the original script or operators. We observe `tool.hook("execute.before")` for the native shell tool, retain its input reference by the native source identifiers, and remove it on execute.after. Only a single scanner resource identical to a closed-grammar complete command may proceed to review. This avoids relying on undocumented metadata or guessing what the scanner omitted. A schema or correlation mismatch asks. The available `shell.create.before` hook lacks session/call identity and is therefore not used as a cross-request correlation store.

`ctx.experimental.generate.text` is stateless generation with a chosen model and string prompt. It does not create a working session or provide execution tools. The deprecated `ctx.generate.text` alias is deliberately unused. The text input has no separate system-message, temperature, maximum-output-token, or JSON-schema parameter; none is invented. `experimental.generate.decisions` offers predicates, not the requested risk/reason decision shape, so the text API plus strict parser was selected.

Promise method declarations accept request options with an AbortSignal. In 2.2.5, `dist/promise/adapter.js` adapts a single input argument and invokes the Effect runtime without forwarding those request options. The code therefore cannot promise provider cancellation from this plugin API. The engine races a deadline, handles both eventual resolution and rejection, and caps unsettled work. A call not settled by the provider still occupies capacity.

`ctx.session.context({sessionID})` returns a readonly union of native session messages, including user entries with text and other entries with content/attachments. The input has no history limit. The adapter uses only a bounded local selection of user text and emits a small closed vocabulary of task-intent labels. It never serializes the message objects, files, attachments, assistant reasoning or tool results into prompts.

`ctx.options` supplies the object form of plugin options. The package exports a default server plugin from its root. Published JavaScript plus declarations can be consumed through package exports without a transpiler or copying source into projects. No stable general plugin logging API appears on the inspected context; fixed JSON records go to a separate local audit file.

## Deployment implications

Pin and test host 2.2.5 with SDK 2.2.5. An older cached SDK, 2.0.29, has only the earlier generation placement and is not the target. Future minor versions must be reviewed because generation is experimental. Broad native shell ask protects the deployment if a plugin fails to load, while specific hard denies remain independent.

Global auto-approval can settle an ask without a person. A plugin only controls its evaluation point: it cannot guarantee another plugin does not change later input/effects, or that a client renders manual approval. The native host probe is separate from deterministic mocked integration tests; its execution status is recorded in VERIFICATION.md.

## Release smoke scope

The credential-free native harness installs the npm archive outside the checkout and loads it through host 2.2.5. A controlled loopback HTTP server implements the minimal OpenAI-compatible chat protocol for independent `smoke/working` and `smoke/reviewer` models. Native generation, HTTP transport and the Promise adapter remain in the path. Synthetic credentials are confined to the isolated host, and a test-only `session.http.request` guard rejects non-loopback destinations for working sessions.

An attempted replacement through the declared `aisdk.hook("language")` did not intercept the native OpenAI transport. Its synthetic key was rejected by OpenAI before any tool ran. Do not assume AI SDK hooks replace native provider implementations in this host. The final harness uses a custom compatible provider with an explicit loopback base URL instead.

The driver uses `tool.transform` to replace the built-in shell implementation with `permission.assert`, supplying the native tool context's session/message/call identifiers. Actual `execute.before` and `execute.after` hooks still run. A `shell.create.before` guard rejects any attempt to create a shell if substitution fails. This tests real host source correlation, permission effects, pending requests and hook lifecycle, but does not prove the original scanner or executor uses the same source shape. A separate original-scanner phase was added on 2026-11-09, with its verified pre-spawn interception described below. Completed-call source removal is verified in deterministic adapter tests; a repeated assertion within a native completion hook did not emit a fresh evaluation and is not used as evidence for that property.

Host startup requires temporary HTTP Basic authentication in this environment. The smoke sets a fresh per-run password and supplies it only to its local client. It does not inherit account credentials. Project probing remains inside an ignored temporary directory beneath the checkout: an initial probe in an unrelated `/tmp` project returned an empty plugin list. Do not infer plugin loading merely from successful server startup.

## Custom reviewer instructions

The `systemPrompt` option is bounded operator-supplied text appended to the built-in
instructions in the existing single prompt string. It is not a new SDK parameter
or a provider system-message role. Local eligibility, parsing, source correlation
and final policy remain independent and unchanged.

## Generic stateful project review

The generic loop uses the same `experimental.generate.text` call and single prompt
string. Evidence requests are a strict local JSON protocol implemented by the
plugin, not invented SDK tool calls. Each round is stateless generation with the
current complete command and accumulated evidence. No provider session or working
agent is created. Native SDK declarations and dependency versions are unchanged.

The injectable evidence source provides bounded Node filesystem reads, directory
listings and recursive literal searches. The adapter supplies the project root
and session ID locally; session IDs never reach prompts; audit includes session IDs. State includes
bounded evidence fingerprints and fixed findings, not persisted file content or
approvals. Findings are exposed only after matching evidence is freshly acquired.

Stateless parsing retains its original scalar-only protocol. Generic parsing
additionally permits string arrays for evidence references and effects, with a
flat-object duplicate-key lexer and exact action-specific schemas. Model safety
judgment replaces the removed Make/Bash parsers. Scanner fragments may be multiple
and are supplemental to the captured complete command; all inputs are rechecked.

Bun 1.3.11's directory handle `close()` can return undefined despite the Node
Promise declaration. Cleanup uses `await` with try/catch rather than chaining
`.catch()` on its return value. Evidence failures remain fixed local codes.

The controlled native smoke adds a generic evidence request/final-decision phase
using the installed archive, inert replacement shell and loopback provider. This
is separate from original-scanner, remote-provider and interactive-client acceptance.

## Built-in free-provider harness

The pinned 2.2.5 client exposes `model.list({ location, types: ["chat"] })`,
returning `data: ModelInfo[]`. `ModelInfo` contains `providerID`, `enabled`,
`status`, text capabilities and a `cost` array with input/output/cache prices
for each tier. An empty array does not prove free usage. The new harness accepts
only an explicitly selected `opencode` model with nonempty all-zero pricing;
it never adds custom pricing or silently falls back to another model.

`scripts/free-provider-smoke.ts` reuses the existing installed-archive checker,
loopback working provider and inert native driver. Discovery runs before loading
the plugin. It then reloads with the selected native reviewer, preserving isolated
HOME/XDG paths and synthetic fixtures. Only one eligible stateless review is
submitted; host-internal retries remain possible. Provider errors and conservative
asks are reported as incomplete acceptance, without exposing provider responses
or host diagnostics. Remote stateful and original-scanner acceptance are deferred.

## Original 2.2.5 scanner and pre-spawn interception — 2026-11-09

Inspected the installed 2.2.5 SDK declarations and the JavaScript embedded in the
actual Linux x64 CLI at `/tmp/permission-gate-host/node_modules/@opencode/cli-linux-x64/bin/opencode`.
The local binary reports 2.2.5. The observations below refer to this pinned artifact,
not moving upstream source or the mocked host.

The native shell input schema includes `command`, optional `workdir`, `timeout`
and `background`. `ShellTool.Plugin` calls `Shell.create` with the command and
workdir plus a preparation callback. The observed order is:

1. `tool.execute.before` observes native input and session/message/call IDs.
2. `Shell.create` builds shell input and triggers `shell.create.before`.
3. Its preparation callback (`ShellTool.prepare`) resolves cwd, invokes the portable
   scanner, authorizes external directories, and awaits shell `permission.assert`.
4. Permission evaluation receives resources from `scan.commands[].resource` and
   `{type: "tool", messageID: context.messageID, id: context.id}` with session ID.
5. Only after preparation succeeds does `Shell.create` enter its scoped work and
   call `spawner.spawn`. The native assertion rejects a deny effect before that point.

The hook dispatcher awaits callbacks in registration order and returns the mutable
event. A `shell.create.before` hook that always throws stops before the scanner,
so the old guard by itself establishes no original-scanner compatibility.

The new phase of `scripts/live-smoke.ts` loads the installed archive, preserves the
original shell implementation and scanner, and registers a test-only final
permission hook. It records the censor's decision, then forces native deny for all
permission actions. Its shell creation hook permits preparation only for the fixed
scanner fixtures; unexpected commands stop immediately. All fixtures contain an
ordinary scanner-visible command and reach the shell assertion. No permission
reply is sent, and no reviewed source reaches process creation. This is an explicit
supported permission interception point, not a shell executor or a reconstructed scanner.

Observed resources are exact command strings for `ls`, `ls -la`, `ls -lah`,
`git status`, `git status --short`, and `git status --porcelain`, including native
workdirs `packages/app`. They correlate with the observed native source IDs and
reach the existing stateless reviewer. Unsupported `ls .`, `ls --recursive` and
`git status --branch` produce `command_outside_grammar`; compounds and pipelines
produce resources `["ls", "git status"]` and `multiple_resources`. Exact inspections
receive `review_allowed` with the deterministic loopback allow response. No adapter
mismatch or scanner-matching relaxation was required. These diagnostics explain
this probe's prompts; they cannot establish why an unrelated deployment prompts
without its own version 2 detail codes.

The scanner also derives permission-save patterns independently of resources and
handles directory-changing commands specially. Neither is treated as complete
source. Existing strict equality and source expiry/mutation checks remain intact.
Tests never execute scanner fixtures. Remote-provider and interactive approval
acceptance remain separate from these controlled-provider observations.

## Workflow contracts

Hybrid uses the existing stateless generation protocol for eligible inspections,
without evidence acquisition. It uses the stateful protocol for other eligible
commands and never retries an inspection decision through the project path.
Both paths preserve independently configured restrictions; hybrid inspection
conservatively treats every candidate as potentially reading the workspace and
executing a process for `forbiddenEffects`. Explicit stateful behavior and the
default stateless strategy remain distinct.

Source snapshots retain the complete command and native workdir, with exact field
rechecks after waiting and before allow. Filesystem validation uses canonical root
containment, rejects workdir symlink components, and compares device/inode identities
for the root and every workdir component. The native workdir is normalized into a
project-relative prompt field; evidence paths remain root-relative. Filesystem
checks cannot close the final check/run race. Findings and discovery hints include
workdir identity so they cannot cross directories without fresh investigation.

The local engine schedules at most eight active or still-unsettled tasks, with
FIFO project waiters (32 global/eight per session). Admission skips busy sessions
without skipping older work within that session. The deadline begins at gate entry;
queued expiry makes zero generation calls. A task retains its active slot/session
lock until underlying source/context/evidence/generation/recheck work settles,
even after timeout. This requires no new SDK methods or cancellation guarantees.

## Native home-relative workdirs — 2026-11-09

Reinspected `FileAccess.resolve` in the actual pinned Linux x64 2.2.5 binary.
Its shared path helper passes `~` as the host home and joins leading `~/` paths
onto that home before resolving against the project. `windowsPath` is an identity
function in this artifact. Node `path.resolve(project, "~/app")` instead resolves
a literal `~` project directory and therefore cannot establish the native location.

The plugin now rejects exact `~` and leading `~/` in captured native workdir fields
before resolving directories, acquiring evidence or generating a prompt. It does
not read or transmit the home directory to emulate expansion. Ordinary absolute
and explicit relative paths retain containment and identity checks. `./~/app` is
an explicit literal project path in this host and is covered separately. Input
mutation to a home-relative workdir while review is pending also prevents allow.
Regression fixtures create literal project `~/app` directories without executing
reviewed strings and cover stateless, stateful and hybrid decisions.
