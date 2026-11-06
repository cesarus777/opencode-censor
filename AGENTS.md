# Repository instructions

@/home/julius/.codex/RTK.md

## Project

`opencode-censor` is an ESM TypeScript server plugin for OpenCode V2.
It reviews shell permissions with an independently configured model. It never
executes commands, creates working agents, or supplies an approval interface.

Read `README.md`, `SECURITY.md`, and `docs/RESEARCH.md` before changing the
permission boundary. Keep `docs/VERIFICATION.md` accurate about what was tested.
Documentation is in English; communicate with the user in their chosen language.

## Security invariants

- Preserve explicit native `deny` and leave non-shell permissions unchanged.
- Default to `ask` for errors, uncertainty, missing source information, invalid
  configuration, malformed responses, timeout, overload, and unload.
- An automatic `allow` requires both valid model output and independent local
  policy. Model output and task context cannot weaken that policy.
- Treat scanner resources as fragments, never as proof of a complete script.
  Correlate native tool input with session/message/call identifiers and recheck
  input and resources after asynchronous review.
- Keep the automatic-approval grammar narrow. Changes that expand it require
  explicit security reasoning, regression tests, and updated documentation.
- Never execute reviewed command strings in the plugin or tests. Do not add a
  shell executor, approval UI, backend, MCP server, or automatic permission replies.
- Do not transmit raw history, file contents, credentials, or environment values.
  Context remains opt-in and limited to the fixed intent-label vocabulary.
- Audit only fixed metadata and local reason codes. Do not log commands, raw
  provider responses, context, secrets, or exception messages.
- Bound concurrent work and total waiting time. Late results cannot change a
  completed decision; late rejections must be handled. Dispose registrations and
  clear temporary state on unload or partial setup failure.
- Keep approval caching and command logging disabled. Never add unconditional
  auto-approval or bypass native hard-deny rules.

## Implementation

- Use strict TypeScript, ESM imports with `.js` extensions, and no unneeded `any`.
- Keep SDK integration in the adapter; keep policy, parsing, and review logic
  independently testable through dependency injection.
- Use native `Plugin.define`, permission hooks, plugin options, and stateless
  generation. Do not replace V2 APIs with V1 hooks or invent SDK members.
- Target the pinned `@opencode/plugin` and host version, currently 2.2.5. When
  upgrading, inspect real declarations and implementation, particularly the
  experimental generation API and cancellation behavior, and update research.
- Keep dependencies minimal, versions reproducible in `bun.lock`, and package
  exports compatible with standalone installation.
- Prefer focused changes. Do not modify unrelated user work or fabricate live
  verification, repository metadata, maintainer identity, or credentials.

## Validation

Use Bun 1.3.11 or later and Node 22 or later. Verify the active Bun version;
older system binaries may be present.

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test tests
bun run build
bun run test:package
```

`bun run check` runs the complete sequence after dependency installation.
`lint` checks Prettier formatting; TypeScript checks types and unused code.
Use deterministic mocked reviewer responses for security regression tests.
Cover fail-safe decisions, source correlation, contradictory or duplicate JSON
fields, concurrent evaluations, late responses, and cleanup when changing them.

The optional native probe is:

```sh
OPENCODE_BIN=/absolute/path/to/opencode bun run test:live
```

Mock-host tests, installed-package import, native host probing, and live-provider
acceptance are different checks. Report each honestly. If subprocess or loopback
restrictions prevent a check, record the restriction; never mark it passed.
Direct pack/install/import checks may validate the artifact when the package
orchestrator is blocked. Live-provider tests require configured credentials.

## Documentation and releases

Update README options, examples, threat model, and tests when public behavior
changes. The plugin is not a sandbox; model mistakes, trusted host configuration,
other plugins, and global auto-approval remain relevant limitations.

Do not commit dependencies, generated `dist`, archives, coverage, temporary smoke
state, credentials, or local agent/account configuration. Stage project files
deliberately and inspect the staged diff before committing. Use a concise,
imperative commit message describing the final change.

Do not publish to npm, push to a remote, or create a release without explicit
user authorization. Before an authorized release, run available checks, inspect
the actual npm archive, verify standalone installation, confirm package ownership,
and document any acceptance work still outstanding.
