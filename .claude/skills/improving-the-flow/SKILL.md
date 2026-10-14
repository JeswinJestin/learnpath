---
name: improving-the-flow
description: Use when tuning LearnPath's diagnostic flow (lib/learnpath.ts) to raise eval accuracy — the disciplined baseline → hypothesis → minimal edit → gate → keep-or-revert loop, with the editable-surface and no-overfit rules.
---

# Improving the LearnPath Flow

The flow is `buildQuestions()` + `decideRecommendation()` in `lib/learnpath.ts`.
That file is the ONLY thing you may edit to raise accuracy.

## The loop (one accepted change at a time)
1. **Baseline.** Ensure `eval/reports/latest.json` holds the pre-change score
   for the split you target (the orchestrator records this first).
2. **Diagnose.** Read the failing cases and the flow's own `reasons`. Find the
   single rule or threshold responsible.
3. **One hypothesis.** Write it down in one sentence before editing.
4. **Minimal edit.** Change one rule/threshold. Prefer generalizable logic
   (evidence-shape rules) over narrow special cases.
5. **Gate.** `npm run eval:gate` must pass: surface (only `lib/learnpath.ts`),
   lint (no hard-coded ids/names), `tsc`, and no train/holdout regression.
6. **Keep or revert.** Keep only if the gate passes and the targeted split did
   not drop. Otherwise `git checkout -- lib/learnpath.ts` and try again or stop.

## Hard rules
- Editable surface: `lib/learnpath.ts` only. Nothing else, ever.
- No hard-coded scenario ids or student names (the lint rejects quoted ids/names).
- If `buildQuestions()` changes, the cache is stale — re-record before trusting
  a `cache` score (`npm run eval:record`).
- Changing the scoring WEIGHTS is a methodology change, not a flow improvement —
  out of scope here.
- Honesty over score: if the only way up is to overfit or special-case, stop and
  report that instead.
