# LearnPath Eval Harness

Deterministic accuracy scoring for the diagnostic flow (`lib/learnpath.ts`).

## Score

Weighted accuracy over gold-labeled student scenarios:
`likelyNeed` 0.6 · `intervention.id` 0.25 · `needsTeacherReview` 0.15.
History: [`reports/scoreboard.md`](reports/scoreboard.md).

## Run

```bash
npm run eval:demo      # offline deterministic heuristic (CI-safe)
npm run eval           # recorded real Jev, replayed (default tuning backend)
npm run eval:live      # real Jev now (needs .env.local key; non-deterministic)
npm run eval:record    # record/refresh the Jev cache (needs key)
npm run eval:train     # train split only (holdout excluded)
npm run eval:holdout   # held-out split only
npm run eval:gate      # accept gate: surface + lint + typecheck + no-regression
npm run test:eval      # harness unit tests
```

## Backends

- `demo` — the in-repo `demoJev` heuristic. Offline, instant, deterministic.
- `cache` — real Jev recorded once per scenario, keyed by scenario id + a hash
  of the question set. Replayed so only your rule edits move the score. A
  question-set change invalidates the hash; re-run `eval:record`.
- `live` — real Jev now. Truth-check only; never the accept gate.

## Splits & guards

`train` is what the build agent tunes on; `holdout` is hidden from it and must
never regress. The gate also forbids edits outside `lib/learnpath.ts` and
rejects hard-coded scenario ids/names. See the spec, `docs/superpowers/specs/`.
