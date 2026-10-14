import { test } from "node:test";
import assert from "node:assert/strict";
import { runEval, buildBaseline } from "./run";
import type { RunReport } from "./types";

test("runEval(demo, all): every case is a full pass after iteration 1", async () => {
  // Iteration 1 routed conflicting evidence (Dev) to insufficient_evidence, so
  // the demo baseline is now 100% across all 9 cases. (Pre-iteration it was
  // 90.56% with Dev the lone failure — see scoreboard history.)
  const report = await runEval("demo", "all");
  assert.ok(report.cases.every((c) => c.score === 1), "all cases pass on demo/all");
  const dev = report.cases.find((c) => c.id === "dev")!;
  assert.ok(dev.needMatch && dev.interventionMatch && dev.reviewMatch, "Dev is now fully correct");
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

test("buildBaseline captures BOTH split scores so one gate run can guard each", () => {
  const train = { backend: "demo", split: "train", score: 87.86 } as RunReport;
  const holdout = { backend: "demo", split: "holdout", score: 100 } as RunReport;
  const b = buildBaseline("demo", train, holdout);
  assert.equal(b.train, 87.86);
  assert.equal(b.holdout, 100);
  assert.equal(b.backend, "demo");
  assert.ok(typeof b.timestamp === "string" && b.timestamp.length > 0);
});
