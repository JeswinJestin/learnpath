# LearnPath — Water Cycle diagnostic

> A low score tells us a student is *struggling*. It doesn't tell us *what help they need*.

LearnPath is a teacher-facing tool for a single Grade-5 topic (the **water cycle**). Two students can both score 40% for completely different reasons — one is missing a prerequisite (evaporation), another understands the stages but can't apply them. LearnPath gathers targeted evidence, uses the **Jev decision model** to interpret it, and then **its own deterministic code** picks the next intervention.

## How Jev is used (and where it is *not* trusted)

Jev is a structured-decision ("System 1") model: we send one **state** (the student's evidence) and several **typed questions** in a single request, and get back probabilities — not prose.

| Question | Type | Purpose |
|---|---|---|
| `likely_need` | Choice | prerequisite_gap / conceptual_misunderstanding / application_difficulty / insufficient_evidence |
| `evidence_strength` | Score | how strongly the evidence supports that need |
| `enough_evidence` | Boolean (Noul) | is there enough to prescribe without asking more? |
| `serious_prerequisite_gap` | Boolean (Noul) | must a prerequisite be fixed first? |

**The final decision is made by code, not the model** (`lib/learnpath.ts`):

1. Thin evidence → never prescribe; ask one diagnostic question.
2. A *directly-observed* failed prerequisite check overrides a non-prerequisite guess from Jev.
3. Contradiction (Jev says "gap" but the prerequisite check is strong) → flag for teacher review and collect more.
4. Weak evidence strength or low choice confidence → flag for teacher review.

## The self-improving eval loop (`eval/`)

The decision flow (`lib/learnpath.ts`) is only as good as it is *accurate*, so
LearnPath ships a deterministic harness that measures that accuracy and a set of
agents that improve it — **editing only the flow, never the rest of the app.**

- **Score.** Each gold-labeled student scenario is run through the real flow and
  scored on three fields — `likelyNeed` (0.6), `intervention` (0.25),
  `needsTeacherReview` (0.15). The run prints a confusion matrix and appends to
  [`eval/reports/scoreboard.md`](eval/reports/scoreboard.md).
- **Deterministic backends.** `demo` (offline heuristic), `cache` (real Jev
  recorded once per scenario and replayed, so only rule edits move the score),
  and `live`. A question-set change invalidates the cache and must be re-recorded.
- **No-overfit guards.** A hidden **holdout** split the tuner never sees, a
  **surface guard** (`git status` must show only `lib/learnpath.ts`), a **lint**
  that rejects hard-coded student ids/names, and a two-split **baseline** the
  accept gate refuses to run without.
- **Agents (`.claude/`).** `project-context` (grounds each pass), `write-checks`
  (grows the gold set), and `build` (the only agent allowed to edit the flow),
  driven by the `/improve-flow` orchestrator and the accept gate (`npm run eval:gate`).

```bash
npm run eval:demo      # score the flow offline (deterministic)
npm run test           # harness unit tests (50)
npm run eval:baseline  # record the two-split baseline the gate guards
npm run eval:gate      # surface + lint + typecheck + no-regression gate
```

Current accuracy on the gold set (demo backend): **100%** — see the scoreboard
and [`eval/README.md`](eval/README.md) for the methodology.

## Project layout

```
lib/learnpath.ts   the diagnostic flow (questions + deterministic decision)
lib/jev.ts         provider-agnostic Jev client (server-side key)
lib/api-guard.ts   rate limiting + input bounding for the API routes
app/api/*          recommend (one student) and cohort (all students) routes
eval/              the accuracy harness, gold scenarios, and scoreboard
.claude/           the improvement agents, skills, and /improve-flow command
docs/superpowers/  the design spec and implementation plan
```

## Security

The API routes proxy a paid key, so they are rate-limited, bound to the known
demo cohort by default, and never leak provider error detail to clients. See
[`SECURITY.md`](SECURITY.md).

## Run it

```bash
npm run dev
```

Open http://localhost:3000. Without a key it runs a **clearly-labeled demo** (never presented as real Jev output).

## Wire the real Jev key

1. Put your key in `.env.local`:
   ```
   JEV_API_KEY=sk_your_key_here
   JEV_PROVIDER=vercel   # vercel | openrouter | aimlapi | typesafe
   ```
2. Confirm a real call:
   ```bash
   npm run verify:jev
   ```
3. Restart `npm run dev`. The result panel will show a green **Live Jev** badge and real latency.

The key is read server-side only (`app/api/recommend/route.ts` → `lib/jev.ts`) and never shipped to the browser.

## Demo script (~90s)

1. Point out the student rail — **same ~40% score** across students.
2. Select **Aarav**, show the failed evaporation check → *Recommend* → prerequisite revision.
3. Select **Meera** (also 40%, strong prerequisite) → *Recommend* → guided application. *Same score, different decision.*
4. Select **Rohan** → conceptual misunderstanding (the "sponge" misconception).
5. Select **Sana** (only a score) → LearnPath refuses to guess and asks for more evidence.
6. (Optional) **Dev** → contradictory evidence → teacher-review flag.
