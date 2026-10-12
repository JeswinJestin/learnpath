import { test } from "node:test";
import assert from "node:assert/strict";
import { runEval } from "./run";

test("runEval(demo, all): Dev is the only failing seed case at baseline", async () => {
  const report = await runEval("demo", "all");
  const dev = report.cases.find((c) => c.id === "dev")!;
  assert.equal(dev.needMatch, false, "Dev's need is misclassified by the baseline flow");
  // Every other case is a full pass at baseline on the demo backend.
  const others = report.cases.filter((c) => c.id !== "dev");
  assert.ok(others.every((c) => c.score === 1), "all non-Dev cases pass at baseline");
});

test("runEval(demo, holdout): holdout passes fully at baseline", async () => {
  const report = await runEval("demo", "holdout");
  assert.equal(report.score, 100);
});

test("runEval reports a numeric 0..100 score and a confusion matrix", async () => {
  const report = await runEval("demo", "all");
  assert.ok(report.score >= 0 && report.score <= 100);
  assert.ok(report.confusion.insufficient_evidence); // dev/sana/priya expected here
});
