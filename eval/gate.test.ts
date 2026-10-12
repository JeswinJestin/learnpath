import { test } from "node:test";
import assert from "node:assert/strict";
import { gateVerdict } from "./gate";

const base = {
  changedFiles: ["lib/learnpath.ts"],
  addedLines: ["  const PREREQ_FAIL = 45;"],
  forbidden: ["aarav", "meera", "dev"],
  typecheckOk: true,
  trainScore: 90,
  trainBase: 88,
  holdoutScore: 100,
  holdoutBase: 100,
};

test("gateVerdict: clean improving change passes", () => {
  assert.deepEqual(gateVerdict(base), { ok: true, failures: [] });
});

test("gateVerdict: edit outside the surface fails", () => {
  const v = gateVerdict({ ...base, changedFiles: ["lib/learnpath.ts", "lib/data.ts"] });
  assert.equal(v.ok, false);
  assert.ok(v.failures.some((f) => f.includes("lib/data.ts")));
});

test("gateVerdict: hard-coded id fails", () => {
  const v = gateVerdict({ ...base, addedLines: ['  if (e.id === "dev") …'] });
  assert.equal(v.ok, false);
  assert.ok(v.failures.some((f) => f.includes("dev")));
});

test("gateVerdict: holdout regression fails even if train rose", () => {
  const v = gateVerdict({ ...base, trainScore: 95, holdoutScore: 90, holdoutBase: 100 });
  assert.equal(v.ok, false);
  assert.ok(v.failures.some((f) => f.includes("holdout regressed")));
});

test("gateVerdict: typecheck failure fails", () => {
  const v = gateVerdict({ ...base, typecheckOk: false });
  assert.equal(v.ok, false);
  assert.ok(v.failures.some((f) => f.includes("tsc")));
});
