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

The driver uses `tool.transform` to replace the built-in shell implementation with `permission.assert`, supplying the native tool context's session/message/call identifiers. Actual `execute.before` and `execute.after` hooks still run. A `shell.create.before` guard rejects any attempt to create a shell if substitution fails. This tests real host source correlation, permission effects, pending requests and hook lifecycle, but does not prove the original scanner or executor uses the same source shape. That remains a manual deployment acceptance check. Completed-call source removal is verified in deterministic adapter tests; a repeated assertion within a native completion hook did not emit a fresh evaluation and is not used as evidence for that property.

Host startup requires temporary HTTP Basic authentication in this environment. The smoke sets a fresh per-run password and supplies it only to its local client. It does not inherit account credentials. Project probing remains inside an ignored temporary directory beneath the checkout: an initial probe in an unrelated `/tmp` project returned an empty plugin list. Do not infer plugin loading merely from successful server startup.
