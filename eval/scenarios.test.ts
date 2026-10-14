import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScenarios, forbiddenTokens } from "./scenarios/index";
import { INTERVENTIONS, NEED_TO_INTERVENTION } from "../lib/data";

test("train split excludes holdout; holdout split is only holdout", () => {
  const train = loadScenarios("train");
  const holdout = loadScenarios("holdout");
  assert.ok(train.every((s) => !s.holdout));
  assert.ok(holdout.every((s) => s.holdout));
  assert.equal(loadScenarios("all").length, train.length + holdout.length);
});

test("every expected label is self-consistent (need -> intervention)", () => {
  for (const s of loadScenarios("all")) {
    assert.equal(
      s.expected.interventionId,
      NEED_TO_INTERVENTION[s.expected.likelyNeed],
      `${s.id}: intervention must match need mapping`,
    );
    assert.ok(INTERVENTIONS[s.expected.interventionId], `${s.id}: intervention exists`);
    assert.ok(s.rationale.trim().length > 0, `${s.id}: has a rationale`);
  }
});

test("forbiddenTokens includes every scenario id and name", () => {
  const toks = forbiddenTokens().map((t) => t.toLowerCase());
  for (const s of loadScenarios("all")) {
    assert.ok(toks.includes(s.id.toLowerCase()), `${s.id} id present`);
    assert.ok(toks.includes(s.evidence.name.toLowerCase()), `${s.evidence.name} name present`);
  }
});
