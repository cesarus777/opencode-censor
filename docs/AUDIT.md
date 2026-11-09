# Audit diagnostics

Each audited shell evaluation appends one JSON object to the configured JSONL
file. Version 2 adds structured diagnostics at the default `info` level. Permission
behavior and existing `reason` codes are unchanged. Native configured denies,
non-shell actions, disabled-plugin evaluations and later human decisions remain
outside this audit.

```json
{
  "schemaVersion": 2,
  "timestamp": "2026-11-08T12:00:00.000Z",
  "sessionID": "example-session",
  "command": "git status",
  "action": "shell",
  "decision": "ask",
  "riskLevel": "medium",
  "durationMs": 0,
  "reason": "policy_requires_review",
  "fallback": false,
  "strategy": "stateless",
  "mode": "balanced",
  "stage": "policy",
  "detailCode": "resource_command_mismatch",
  "resourceCount": 1,
  "reviewCalls": 0
}
```

This example establishes only that the captured command and scanner resource
were different. It does not establish why the scanner produced that resource.

| Field                                   | Meaning                                                                                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`                         | `2` for the current schema; old records remain readable by `censor-stats`.                                                                                                                   |
| `sessionID`                             | Native OpenCode session ID, used to group evaluations locally.                                                                                                                               |
| `command`                               | Exact captured command at evaluation start, including whitespace and newlines; omitted when unavailable or `logging.includeCommands` is `false`. Never reconstructed from scanner fragments. |
| `strategy`, `mode`                      | Effective validated settings; `unknown` if configuration is invalid.                                                                                                                         |
| `stage`                                 | The check that determined the result; for timeouts, the active stage at settlement.                                                                                                          |
| `detailCode`                            | First applicable local diagnostic, without provider prose or exception messages.                                                                                                             |
| `resourceCount`                         | Scanner resource count at evaluation start, before asynchronous review.                                                                                                                      |
| `reviewCalls`                           | Number of plugin generation invocations started before settlement, including failed calls. Always present, including zero. Does not count host/provider internal retries.                    |
| `reviewerConfidence`                    | Confidence from a validated final reviewer response, when supplied.                                                                                                                          |
| `reviewerDecision`, `reviewerRiskLevel` | Validated model result, distinct from the final policy decision. Retained if a subsequent input recheck blocks approval.                                                                     |

Stage values are `configuration`, `source`, `policy`, `context`, `reviewer`,
`evidence`, `recheck`, `admission` and `lifecycle`. Existing `evidenceCount` and
validated `reviewerReasonCode` fields remain available for stateful review.
Call counts and diagnostics are snapshots; late replies cannot alter a record.
Unavailable confidence is omitted rather than estimated.

## Diagnosing repeated prompts

| Detail code                                                                                                   | Meaning                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invalid_configuration`                                                                                       | Options could not be validated. Commands are omitted; auditing falls back to stderr.                                                                      |
| `missing_source_identifiers`                                                                                  | Permission event has no native tool source.                                                                                                               |
| `capture_missing`                                                                                             | No captured input matches the native session/message/call key. This can include completed, pruned or unadmitted captures; the audit does not guess which. |
| `capture_expired`                                                                                             | Matching captured input is older than its correlation deadline.                                                                                           |
| `invalid_command`                                                                                             | Captured command is not a string.                                                                                                                         |
| `invalid_workdir`                                                                                             | Captured working directory is not a string.                                                                                                               |
| `external_workdir`                                                                                            | Stateless working directory is outside the project.                                                                                                       |
| `stateful_workdir_mismatch`                                                                                   | Stateful working directory differs from the evidence root.                                                                                                |
| `resources_missing`, `multiple_resources`                                                                     | Stateless review requires exactly one scanner resource.                                                                                                   |
| `resource_command_mismatch`                                                                                   | The one scanner resource differs from the complete command.                                                                                               |
| `command_outside_grammar`                                                                                     | Complete command fails the selected mode's exact inspection grammar.                                                                                      |
| `command_empty`, `command_too_long`, `too_many_resources`, `input_budget_exceeded`                            | Stateful input is outside configured protocol bounds.                                                                                                     |
| `sensitive_input`, `control_characters`, `shell_syntax_disabled`, `always_ask_match`                          | Stateful input failed the corresponding local disclosure or policy check.                                                                                 |
| `reviewer_requested_approval`                                                                                 | Validated reviewer response requested manual approval.                                                                                                    |
| `reviewer_risk_above_low`, `reviewer_confidence_below_floor`                                                  | Local policy rejected the validated risk or confidence.                                                                                                   |
| `reviewer_uncertain`, `reviewer_reason_not_approved`, `reviewer_unknown_effects`, `reviewer_forbidden_effect` | Stateful final response failed a local approval condition.                                                                                                |
| `context_error`, `provider_error`                                                                             | Context retrieval or stateless generation failed. No exception text is recorded.                                                                          |
| `evidence_error`                                                                                              | Evidence collection or freshness checking threw an error.                                                                                                 |
| `invalid_review_response`                                                                                     | Response failed strict parsing; no model fields are attached.                                                                                             |
| `source_input_changed`, `scanner_resources_changed`                                                           | A previously allowed input failed the final source/resource recheck.                                                                                      |
| `project_changed`                                                                                             | Evidence freshness check failed.                                                                                                                          |
| `timeout`                                                                                                     | Total evaluation deadline expired; inspect `stage` and `reviewCalls`.                                                                                     |
| `review_capacity`, `stateful_busy`                                                                            | Admission limit or same-session stateful serialization prevented review.                                                                                  |
| `unloaded`, `cancelled`                                                                                       | Evaluation stopped during lifecycle cleanup or cancellation.                                                                                              |

Where no more specific detail is supplied, `detailCode` equals the existing
local `reason`, including evidence failures, budget exhaustion and successful
reviews. A stateful `review_error` at the reviewer stage denotes a generation
failure. A risk value of `medium` without a validated reply is a fallback value,
not a model assessment. Parser validation can reject contradictory risk/decision
combinations before they reach final local approval checks.

## Statistics and privacy

`censor-stats [audit.jsonl]` reports approval totals, counts by reason and detail,
and the proportion of known evaluations that reached a reviewer. Legacy records
with a validated reviewer decision establish reviewer reach; records without a
call count or validated decision have unknown reach. Unknown records are shown
separately and excluded from the reviewer-reach denominator. Invalid call counts
are rejected. Set `logging.level: "info"` for complete plugin evaluation totals;
`error` retains only fallback records.

Exact command logging defaults to enabled as explicitly requested by the operator.
Commands may contain secrets and private paths. Set `logging.includeCommands: false`
to omit command text, or `logging.enabled: false` to disable records entirely.
Session IDs are still included when command text is disabled. Keep audit files
private, redact them before sharing and manage retention locally. JSON encoding
escapes embedded newlines, preserving one physical line per record. Scanner text,
context/history, evidence contents, provider prose and exception messages are not
added to these diagnostics. Audit write failure cannot change a permission result.
