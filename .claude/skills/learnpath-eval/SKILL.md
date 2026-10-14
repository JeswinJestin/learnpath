---
name: learnpath-eval
description: Use when running or interpreting the LearnPath eval harness — scoring the diagnostic flow, reading the scoreboard/confusion matrix, choosing a backend (demo/cache/live), or recording the Jev cache.
---

# Running the LearnPath Eval Harness

The score = weighted accuracy of the real flow (`decideRecommendation`) over
gold scenarios: need 0.6 / intervention 0.25 / review 0.15.

## Commands
- `npm run eval:demo` — offline deterministic (CI / quick checks).
- `npm run eval` — recorded real Jev (default for tuning). Needs a recorded cache.
- `npm run eval:train` / `npm run eval:holdout` — split-scoped.
- `npm run eval:record` — (re)record the Jev cache; REQUIRED after any change to
  `buildQuestions()` (the questions hash changes and `cache` runs will abort).
- `npm run eval:gate` — the accept gate (surface + lint + typecheck + no-regress).

## Reading a run
- `PASS/FAIL` per case; the `NIR` marks show which of need/intervention/review matched.
- The confusion matrix is expected-need → actual-need counts; off-diagonal cells
  are where the flow is wrong.
- `reports/latest.json` is the machine-readable last run; `reports/scoreboard.md`
  is the append-only history.

## Determinism rules
- Tune on `cache` or `demo` (both deterministic); never accept a change based on
  a `live` run (it is non-deterministic).
- If a `cache` run aborts with a hash mismatch, run `eval:record` first.
