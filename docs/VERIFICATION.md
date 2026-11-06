# Verification record

Environment: Linux x64, 2026-11-06. SDK dependencies installed from the registry and pinned in `bun.lock`. Target SDK and separately installed native CLI: 2.2.5. The pre-existing system CLI was 2.1.2; it was not modified. Automated tests were run with Bun 1.3.11, TypeScript 5.9.3 and Prettier 3.6.2.

Final automated result: **95 tests passed, 0 failed, 205 assertions**, across four test files.

| Check                        | Result               | Evidence / boundary                                                                                                                                                             |
| ---------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck                    | PASS                 | Strict TypeScript, including production adapter, tests and scripts, against installed SDK declarations                                                                          |
| Lint                         | PASS                 | Prettier check; unused code and type errors are handled by TypeScript                                                                                                           |
| Unit and security tests      | PASS                 | Deterministic mocked model responses, timeout/late-response tests; no reviewed command is executed                                                                              |
| Mocked plugin integration    | PASS                 | Actual SDK `Plugin.define`, mocked host domains; hook registration/effects, error handling, explicit deny defense, correlation and cleanup                                      |
| Build                        | PASS                 | ESM JavaScript, source maps and declarations in `dist`                                                                                                                          |
| npm archive creation         | PASS                 | `npm pack --ignore-scripts --pack-destination /tmp --cache /tmp/permission-gate-npm-cache`, after a successful build                                                            |
| Standalone installation      | PASS                 | Archive installed offline into `/tmp/permission-gate-consumer`, outside this repository; public package export imported successfully                                            |
| Node ESM import              | PASS                 | Compiled root plugin imported through Node, independently of Bun transpilation                                                                                                  |
| `test:package` orchestration | PASS outside sandbox | After renaming to `opencode-censor`, the approved unsandboxed run packed the archive, installed it offline in an isolated consumer, and imported its public export successfully |
| Native host smoke            | ENVIRONMENT BLOCKED  | OpenCode 2.2.5 `serve --hostname 127.0.0.1 --port 0` failed with `EPERM: operation not permitted, listen`; no claim of successful real host loading or UI integration           |
| Live provider                | NOT RUN              | No credentials supplied, and native server cannot bind in this sandbox                                                                                                          |
| npm name check               | Checked              | `npm view opencode-censor version` returned E404 on 2026-11-06 after the project rename; availability may change                                                                |
| Publication                  | NOT RUN              | Explicit user authorization required                                                                                                                                            |

The optional `scripts/live-smoke.ts` is an executable native host probe, not a substitute successful test result. It loads the built package and a test-only driver into isolated configuration. The driver asserts permission resources without executing commands. Expected behavior is explicit deny skipping the hook, and scanner-only input becoming a real pending native approval request. It neither creates model credentials nor approves requests. It needs a normal environment with child-process and loopback access.

The tests under `tests/integration` are **mock-host integration**, not real OpenCode execution. The package consumer test proves installation/export correctness, not host lifecycle or permission ordering. Successful compile-time compatibility does not prove runtime tool-input correlation.

## Required acceptance work before production release

1. On a permitted host with OpenCode 2.2.5, run `bun run check`, then `OPENCODE_BIN=/path/to/opencode bun run test:live`.
2. Connect a real provider through OpenCode, configure a valid independent reviewer model, and attach an interactive native client.
3. Ask the primary agent to run exact `pwd`. Verify the reviewer call and native execution without a prompt. This specifically verifies real shell input/source correlation; a missing correlation must ask.
4. Request a harmless out-of-policy command such as `printf permission-gate-smoke`. Verify a native approval prompt, then reject it. Deterministic tests cover destructive strings without executing them.
5. Select an unavailable reviewer model and request `pwd`. Verify native approval fallback. Test a slow provider and confirm a late answer cannot execute an action or remove the prompt.
6. Add a specific native deny for a harmless probe resource and confirm that it is blocked without calling the reviewer. Test multiple simultaneous requests and a plugin reload.
7. Review dependency supply-chain risk, establish actual repository and security-reporting metadata, confirm npm name ownership and inspect the final archive before publishing.

No absolute security guarantee or completed live acceptance is claimed by this record.
