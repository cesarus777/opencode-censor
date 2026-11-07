import { expect, test } from "bun:test";
import { countAudit } from "../../src/stats.js";

test("counts automatic approvals over audited shell evaluations", () => {
  expect(
    countAudit(
      '{"action":"shell","decision":"allow"}\n{"action":"shell","decision":"ask"}\n',
    ),
  ).toEqual({ total: 2, allow: 1, ask: 1 });
  expect(countAudit("")).toEqual({ total: 0, allow: 0, ask: 0 });
});
test("rejects malformed audit lines instead of reporting misleading totals", () => {
  expect(() => countAudit('{"action":"shell","decision":"deny"}\n')).toThrow();
  expect(() => countAudit("broken\n")).toThrow();
});
