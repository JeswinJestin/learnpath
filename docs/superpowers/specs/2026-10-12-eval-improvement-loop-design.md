# LearnPath Eval-Driven Improvement Loop — Design

**Date:** 2026-10-12
**Status:** Draft for review
**Author:** Jeswin (with Claude Code)

## 1. Purpose & Intended Outcome

LearnPath turns Water-Cycle assessment evidence into a learning-need diagnosis
and a next intervention. The decision flow lives in `lib/learnpath.ts`:
`buildQuestions()` (what we ask the Jev decision model) plus
`decideRecommendation()` (deterministic rules + thresholds that turn Jev's
judgments into the final call — "Jev informs, code decides").

We want a **self-improving evaluation loop**: a system of agents + skills that,
each iteration, measures the flow's diagnostic **accuracy** against a set of
gold-labeled student scenarios and then improves the flow to raise that
accuracy — **without changing anything in the app except the flow itself.**

Success looks like:

- A single, honest, repeatable **SCORE** (weighted accuracy over gold
  scenarios) that we can watch climb across iterations.
- Three named agents — **project-context**, **write-checks**, **build** — each
  with a corresponding skill, that together run the loop.
- Improvements that are provably confined to `lib/learnpath.ts` and that
  generalize (do not overfit the gold set).
- A real, documented project: proper README, eval methodology doc, and an
  append-only scoreboard history.
- An in-app runtime self-grading endpoint so the score is visible in the
  product, not only in the terminal.

This is **not** a hackathon throwaway; it is an ongoing project we will keep
improving and documenting.

## 2. Non-Goals

- No change to the UI, the data model, the Jev client (`lib/jev.ts`), the
  intervention catalog, or the profile code **as a means of raising accuracy**.
  (New additive infrastructure files are created; existing app behavior is not
  modified except within `lib/learnpath.ts`.)
- No change to the Jev HTTP/provider contract (it already works end to end).
- No automatic committing of flow changes without the loop's accept gate
  passing (typecheck green, no regression on train or holdout, surface guard
  clean).

## 3. Key Definitions

- **The flow** — `buildQuestions()` + `decideRecommendation()` in
  `lib/learnpath.ts`. The only accuracy-editable surface.
- **Gold scenario** — a `StudentEvidence` case plus an **expected** label block:
  `{ likelyNeed, interventionId, needsTeacherReview }`, each with a short
  written justification.
- **SCORE** — weighted accuracy of the flow's output vs. the expected label,
  aggregated over a scenario split (see §6).
- **Backend** — where the flow's Jev answers come from during eval:
  `demo` (deterministic heuristic), `cache` (recorded real Jev, replayed),
  `live` (real Jev now).
- **Editable surface** — files an accuracy-improvement step may modify. Fixed
  to exactly `lib/learnpath.ts`.

## 4. Architecture Overview

Three cooperating layers, built additively around the untouched app:

```
                ┌──────────────────────────────────────────┐
  Layer A       │  .claude/ agents + skills + /improve-flow  │  ← I drive these
  (control)     │  project-context · write-checks · build    │     in-session
                └───────────────────┬────────────────────────┘
                                    │ operate on
                ┌───────────────────▼────────────────────────┐
  Layer B       │  eval/  harness · gold scenarios · Jev cache │  ← deterministic
  (measurement) │  run.mjs · record.mjs · scoreboard.md        │     scoring
                └───────────────────┬────────────────────────┘
                                    │ calls the REAL
                ┌───────────────────▼────────────────────────┐
  Layer C       │  lib/learnpath.ts  (the flow — only editable │  ← tuned to
  (subject)     │  surface) + app/api/eval runtime self-grade  │     raise SCORE
                └─────────────────────────────────────────────┘
```

Layer C's `decideRecommendation()` is called unmodified by both the eval
harness (Layer B) and the in-app route — there is exactly one implementation of
the flow, so the terminal score and the product score measure the same thing.

## 5. Layer B — The Eval Harness (`eval/`)

### 5.1 Layout

```
eval/
  scenarios/
    seed.ts          # the 7 existing students, each with an expected-label block
    holdout.ts       # held-out cases (hidden from the build agent)
    index.ts         # loads a split: all | train | holdout
  jev-cache/
    <scenarioId>.<questionsHash>.json   # recorded real Jev answers
  reports/
    latest.json      # machine-readable last run
    scoreboard.md    # append-only: one row per iteration (date, score, backend, split, delta, note)
  run.mjs            # CLI scorer
  record.mjs         # records/refreshes the Jev cache (live calls)
  lib.mjs            # shared: scoring, loading, backend resolution, surface guard
  README.md          # how to run it
  CONTEXT.md         # maintained by the project-context agent
```

`eval/` is run with Node's built-in TS support where possible; scenarios are
authored in `.ts` and imported by the harness via a thin loader, or compiled
on the fly. (Exact runner — `node --experimental-strip-types` vs a tiny `tsx`
dev dep — is a plan-level decision; default to no new runtime deps if Node's
type-stripping suffices on the project's Node version.)

### 5.2 Scoring rubric

For each scenario the flow produces a `Recommendation`. We compare three fields
to the expected label:

| Field | Weight | Match rule |
|---|---|---|
| `likelyNeed` | 0.6 | exact enum match |
| `intervention.id` | 0.25 | exact match (derivable from need, but scored for safety) |
| `needsTeacherReview` | 0.15 | boolean equality |

Per-scenario score = weighted sum of matches (0..1). Run SCORE = mean of
per-scenario scores over the split, reported as a percentage. The run also
emits:

- a **confusion matrix** over `likelyNeed` (expected vs. actual),
- a per-scenario pass/fail table with the flow's `reasons`,
- counts of regressions vs. the previous `latest.json`.

Weights live in one constant block in `eval/lib.mjs` and are themselves part of
the documented methodology (changing them is a methodology change, logged in
the scoreboard note, not a silent tuning knob).

### 5.3 Backends & determinism

- `--backend cache` (**default for tuning**): for each scenario, load the
  recorded Jev answer file keyed by `scenarioId` + a hash of the **current**
  question set. If missing/stale, the run fails loudly and tells you to
  `npm run eval:record`. This guarantees that, between question-set changes, the
  only thing moving the score is your edit to the deterministic rules.
- `--backend demo`: use `demoJev` / `demoProfileJev`. Fully offline, used in CI
  and for quick smoke runs.
- `--backend live`: call real Jev now (truth-check / re-baseline). Non-
  deterministic; never the accept gate.

`record.mjs` makes one live pass over all scenarios with the current questions
and writes the cache files (and prints the questionsHash). Re-recording is
required whenever `buildQuestions()` changes; the hash mismatch enforces it.

### 5.4 Guards (anti-overfit, anti-cheat)

- **Held-out split.** `holdout.ts` scenarios are excluded from `--split train`.
  The build agent tunes on `train` and is **not shown** holdout contents; the
  accept gate re-runs `--split holdout` and rejects any change that lowers the
  holdout score.
- **Surface guard.** Before accepting an iteration the harness runs
  `git diff --name-only` and fails if any path other than `lib/learnpath.ts`
  changed.
- **No-special-casing lint.** The harness scans the `lib/learnpath.ts` diff and
  fails if it introduces a scenario id or student name string literal (e.g.
  `"aarav"`, `"Meera"`), preventing hard-coded answers.
- **Typecheck gate.** `npm run typecheck` must pass.

### 5.5 npm scripts (added to `package.json` — additive, not a flow change)

```
eval          node eval/run.mjs --backend cache --split all
eval:train    node eval/run.mjs --backend cache --split train
eval:holdout  node eval/run.mjs --backend cache --split holdout
eval:demo     node eval/run.mjs --backend demo  --split all
eval:live     node --env-file=.env.local eval/run.mjs --backend live --split all
eval:record   node --env-file=.env.local eval/record.mjs
```

### 5.6 Seed gold set

The 7 students in `lib/data.ts` with labels from `SCENARIO_NOTES`:

| id | expected need | intervention | needsTeacherReview |
|---|---|---|---|
| aarav | prerequisite_gap | prerequisite_revision | false |
| meera | application_difficulty | guided_application | false |
| rohan | conceptual_misunderstanding | alternative_explanation | false |
| sana | insufficient_evidence | ask_diagnostic | false |
| dev | insufficient_evidence | ask_diagnostic | **true** (contradiction → review) |
| priya | insufficient_evidence* | ask_diagnostic | false |
| kabir | (TBD during write-checks) | — | — |

*Priya is secure; the 4-way need Choice has no "on track" option, so the flow
routes a no-problem student to `insufficient_evidence`/`ask_diagnostic`. Whether
that is the *correct* expected label or a known flow limitation to be improved
is exactly the kind of question the write-checks + project-context agents
resolve and document. The seed set records the **current intended** label and a
note; ambiguous cases are flagged, not guessed.

## 6. Layer A — Agents & Skills (`.claude/`)

### 6.1 Subagents (`.claude/agents/*.md`)

Each is a Claude Code subagent with YAML frontmatter (`name`, `description`,
`tools`, `model`) and a body that points at its skill.

- **`project-context`** — tools: `Read, Glob, Grep` (read-only). Produces /
  refreshes `eval/CONTEXT.md`: the domain (Water Cycle skills, needs,
  interventions), the invariants ("Jev informs, code decides"; a directly
  observed prerequisite fail overrides a model guess; thin evidence never
  prescribes), the editable surface, the current flow behavior summarized from
  the code, and the current known failure modes from the latest report. Grounds
  every iteration so changes never violate invariants.

- **`write-checks`** — tools: `Read, Glob, Grep, Write`. Authors new gold
  scenarios into `eval/scenarios/` (edge cases, adversarial evidence, the
  signature "two students, same ~40% score, different evidence → different
  decision" cases), each with a written label justification and a coverage-
  matrix update. Maintains the holdout split. **Never edits `lib/learnpath.ts`.**
  May invoke `eval:record` for new scenarios.

- **`build`** — tools: `Read, Edit, Bash`. The **only** agent permitted to edit
  `lib/learnpath.ts`. Reads `CONTEXT.md` + the latest failing cases, forms one
  hypothesis, changes only the flow, runs `eval:train` + `eval:holdout` +
  `typecheck` + the surface/lint guards, keeps the change only if the gate
  passes and the score does not regress, otherwise reverts.

### 6.2 Skills (`.claude/skills/*/SKILL.md`)

- **`learnpath-eval`** — how to run the harness, read the scoreboard/confusion
  matrix, the scoring rubric, and the backend/determinism rules.
- **`writing-eval-checks`** — how to write a non-leaky labeled case: label
  justification, coverage matrix, edge/adversarial coverage, holdout discipline,
  no label leakage into evidence text.
- **`improving-the-flow`** — the disciplined tuning loop (baseline → read
  failures + CONTEXT → single hypothesis → edit only `lib/learnpath.ts` →
  re-score → keep-if-not-worse-else-revert → log delta), plus the editable-
  surface and no-special-casing rules.

### 6.3 Orchestrator — `/improve-flow` (`.claude/commands/` skill)

Runs one full iteration and is safe to run repeatedly:

1. Dispatch **project-context** → refresh `CONTEXT.md`.
2. (Optional, every Nth run or on request) dispatch **write-checks** → add
   scenarios; re-record cache for new ones.
3. Record **baseline** score (`eval:train` + `eval:holdout`).
4. Dispatch **build** → one hypothesis-driven change under the accept gate.
5. On accept: append a scoreboard row (date, backend, split, old→new score,
   delta, one-line note) and commit `lib/learnpath.ts` + scoreboard. On reject:
   log the attempt and the reason, change nothing.
6. Report the delta and the current confusion matrix.

The loop is **monotonic by construction**: a change is only kept if it does not
lower train or holdout score and passes all gates, so the scoreboard never goes
backwards from accepted iterations.

## 7. Layer C — In-App Runtime Self-Grade (Phase 3)

A new additive route `app/api/eval/route.ts` (and optionally a small `/eval`
panel) that runs the gold set through `recommend()` against **live** Jev and
returns `{ score, perCase, confusion, model, latencyMs }`. This is the
"in-app runtime loop" half of the deliverable: the product can grade itself.
It imports the same scenarios and the same `decideRecommendation`, so it cannot
drift from the terminal harness. The existing routes and UI are untouched; the
optional panel is new.

## 8. Documentation

- Rewrite `README.md` into a real project README: what LearnPath is, the "Jev
  informs, code decides" principle, the eval methodology, how to run the loop,
  and the current score + a link to `scoreboard.md`.
- `eval/README.md` — harness usage and backends.
- `docs/eval-methodology.md` — scoring rubric, weights rationale, anti-overfit
  design, and how to read the scoreboard.

## 9. Error Handling & Edge Cases

- **Missing/stale cache** → `cache` backend fails loudly with the exact
  `eval:record` command to run; never silently falls back to live or demo.
- **No API key** → `live`/`record` fail with the configured guidance; `demo`
  and `cache` still work offline.
- **Ambiguous label** (e.g. Priya) → recorded with an explicit note and
  surfaced in the report; resolved by project-context + write-checks, not
  guessed by the build agent.
- **Build agent tries to edit outside the surface or hard-code an id** → accept
  gate rejects; change reverted; attempt logged.
- **Question-set change** → cache hash mismatch forces a re-record before any
  cache-backed score is trusted.

## 10. Testing

- The harness is itself tested with a tiny fixture: a stub flow + stub scenarios
  with known outcomes, asserting the scorer produces the expected SCORE,
  confusion matrix, and regression counts.
- The surface guard and no-special-casing lint are tested with a crafted diff
  that must be rejected.
- `eval:demo` runs in CI (offline) as a regression smoke test on every change.

## 11. Phasing

- **Phase 1 — Harness:** `eval/` (scenarios seed + holdout, run/record/lib,
  scoreboard, guards), npm scripts, harness self-tests, first baseline recorded.
- **Phase 2 — Agents & loop:** the 3 subagents, 3 skills, `/improve-flow`
  orchestrator; then run 2–3 real iterations to demonstrate the score climbing
  on cache backend with holdout holding.
- **Phase 3 — Runtime + docs:** `app/api/eval/route.ts` (+ optional panel),
  README rewrite, `eval/README.md`, `docs/eval-methodology.md`.

## 12. Open Questions (to resolve during implementation)

- Node TS-running strategy for `eval/*.ts` scenarios (type-stripping vs. tiny
  dev dep) — pick the zero-new-runtime-dep option if the project's Node allows.
- Kabir's and Priya's canonical expected labels — resolved by project-context +
  write-checks with written justification before they count toward SCORE.
- Whether the optional `/eval` UI panel ships in Phase 3 or is deferred.
