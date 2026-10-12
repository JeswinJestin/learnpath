---
description: Run one LearnPath accuracy iteration — context → (optional checks) → baseline → build → gate → scoreboard. Safe to run repeatedly; never regresses an accepted score.
argument-hint: "[--with-checks] [--backend demo|cache]"
---

Run ONE improvement iteration of the LearnPath diagnostic flow. Default backend
is `demo` (offline, deterministic); pass `--backend cache` only if the Jev cache
has been recorded (`npm run eval:record`).

Steps:

1. **Context.** Dispatch the `project-context` agent to refresh `eval/CONTEXT.md`.
2. **Checks (only if `--with-checks`).** Dispatch the `write-checks` agent to add
   one or more gold scenarios. If it added any and backend is `cache`, run
   `npm run eval:record`.
3. **Baseline.** Run `npx tsx eval/run.ts --backend <backend> --split train --note "baseline"`
   then `--split holdout`. This writes `reports/latest.json` (the gate's baseline).
4. **Build.** Dispatch the `build` agent with `eval/CONTEXT.md` and the failing
   TRAIN cases from `reports/latest.json` (do NOT pass holdout contents). It makes
   one minimal edit to `lib/learnpath.ts` and runs `npm run eval:gate`.
5. **Record result.**
   - If the gate passed and train rose: run
     `npx tsx eval/run.ts --backend <backend> --split all --note "<one-line change summary>"`
     to append the new score, then commit `lib/learnpath.ts` + `eval/reports/*`
     (and any new scenarios) with a message describing the change and the
     old→new score.
   - If the gate failed or no safe change was found: ensure
     `git checkout -- lib/learnpath.ts`, append a scoreboard note
     (`--note "no accepted change: <reason>"`), and report.
6. **Report** the delta and the current confusion matrix to the user.

Invariants: only `lib/learnpath.ts` may change for accuracy; holdout is never
shown to the build agent; a change is kept only if no split regresses.
