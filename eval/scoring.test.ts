import { test } from "node:test";
import assert from "node:assert/strict";
import { WEIGHTS, scoreCase, aggregate, confusionMatrix, regressionsVs } from "./scoring";
import type { CaseResult, RunReport } from "./types";

const exp = { likelyNeed: "prerequisite_gap", interventionId: "prerequisite_revision", needsTeacherReview: false } as const;

test("scoreCase: full match scores 1.0", () => {
  const r = scoreCase("x", { ...exp }, { ...exp }, []);
  assert.equal(r.score, 1);
  assert.ok(r.needMatch && r.interventionMatch && r.reviewMatch);
});

test("scoreCase: only need matches scores 0.6", () => {
  const actual = { likelyNeed: "prerequisite_gap", interventionId: "ask_diagnostic", needsTeacherReview: true } as const;
  const r = scoreCase("x", actual, exp, []);
  assert.equal(r.score, WEIGHTS.need);
});

test("scoreCase: only review matches scores 0.15", () => {
  const actual = { likelyNeed: "application_difficulty", interventionId: "guided_application", needsTeacherReview: false } as const;
  const r = scoreCase("x", actual, exp, []);
  assert.equal(r.score, WEIGHTS.review);
});

test("aggregate: mean of case scores as percentage", () => {
  const cases = [{ score: 1 }, { score: 0.15 }] as CaseResult[];
  assert.equal(aggregate(cases), 57.5);
});

test("aggregate: empty split returns 0, not NaN", () => {
  assert.equal(aggregate([]), 0);
});

test("confusionMatrix: counts expected->actual need pairs", () => {
  const cases = [
    { expected: { likelyNeed: "prerequisite_gap" }, actual: { likelyNeed: "prerequisite_gap" } },
    { expected: { likelyNeed: "insufficient_evidence" }, actual: { likelyNeed: "application_difficulty" } },
  ] as CaseResult[];
  const m = confusionMatrix(cases);
  assert.equal(m.prerequisite_gap.prerequisite_gap, 1);
  assert.equal(m.insufficient_evidence.application_difficulty, 1);
});

test("regressionsVs: ids that passed before and fail now", () => {
  const prev = { cases: [{ id: "a", score: 1 }, { id: "b", score: 1 }] } as RunReport;
  const now = [{ id: "a", score: 1 }, { id: "b", score: 0.6 }] as CaseResult[];
  assert.deepEqual(regressionsVs(prev, now), ["b"]);
});
