import { test } from "node:test";
import assert from "node:assert/strict";
import { gateVerdict, parseChangedFiles, isSurfaceRelevant } from "./gate";

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

test("parseChangedFiles: includes untracked (??) files so they can't bypass the surface guard", () => {
  const porcelain = " M app/page.tsx\n?? eval/sneaky-helper.ts\n";
  assert.deepEqual(parseChangedFiles(porcelain), ["app/page.tsx", "eval/sneaky-helper.ts"]);
});

test("parseChangedFiles: a rename reports the new path", () => {
  assert.deepEqual(parseChangedFiles("R  lib/old.ts -> lib/new.ts\n"), ["lib/new.ts"]);
});

test("parseChangedFiles: empty output is no changes", () => {
  assert.deepEqual(parseChangedFiles(""), []);
});

test("surface guard catches an untracked file outside the flow (end-to-end via parse)", () => {
  const changed = parseChangedFiles(" M lib/learnpath.ts\n?? lib/backdoor.ts\n");
  const v = gateVerdict({ ...base, changedFiles: changed });
  assert.equal(v.ok, false);
  assert.ok(v.failures.some((f) => f.includes("lib/backdoor.ts")));
});

test("fail-closed: a git-quoted special-char path never equals the flow file, so it is flagged", () => {
  // git quotes paths with special chars, e.g. `?? "lib/odd\tname.ts"`. The quoted
  // string can't equal lib/learnpath.ts, so the surface guard must reject it.
  const changed = parseChangedFiles('?? "lib/odd name.ts"\n');
  const v = gateVerdict({ ...base, changedFiles: changed });
  assert.equal(v.ok, false, "a quoted/exotic path must be treated as outside the surface");
});

test("fail-closed: renaming the flow file OUT is caught (new path flagged)", () => {
  const changed = parseChangedFiles("R  lib/learnpath.ts -> lib/moved.ts\n");
  const v = gateVerdict({ ...base, changedFiles: changed });
  assert.equal(v.ok, false);
  assert.ok(v.failures.some((f) => f.includes("lib/moved.ts")));
});

test("isSurfaceRelevant: generated eval reports are ignored, flow + source are not", () => {
  assert.equal(isSurfaceRelevant("eval/reports/latest.json"), false);
  assert.equal(isSurfaceRelevant("eval/reports/scoreboard.md"), false);
  assert.equal(isSurfaceRelevant("lib/learnpath.ts"), true);
  assert.equal(isSurfaceRelevant("lib/data.ts"), true);
});

test("report churn does not trip the surface guard; a source edit still does", () => {
  const onlyReports = parseChangedFiles(" M lib/learnpath.ts\n M eval/reports/latest.json\n M eval/reports/scoreboard.md\n").filter(isSurfaceRelevant);
  assert.deepEqual(onlyReports, ["lib/learnpath.ts"]);
  assert.ok(gateVerdict({ ...base, changedFiles: onlyReports }).ok);

  const withSource = parseChangedFiles(" M lib/learnpath.ts\n M lib/data.ts\n M eval/reports/latest.json\n").filter(isSurfaceRelevant);
  assert.equal(gateVerdict({ ...base, changedFiles: withSource }).ok, false);
});
