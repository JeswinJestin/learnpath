# LearnPath — an **intervention layer** built on Jev

> **The idea, not the topic.** LearnPath is a working demonstration of a *reusable pattern*: a thin **intervention layer** that sits between raw evidence and the action taken on it. It uses **Jev** (TypeSafe AI's System-1 decision model) to turn messy evidence into a few **bounded, calibrated judgments**, then uses **your own deterministic code** to decide the intervention — with reason codes, confidence gating, and a human in the loop.
>
> The **Water Cycle, Grade-5 classroom is just the example** I picked to make the pattern tangible and easy to present. The real deliverable is the *layer* — and it drops into any domain where you have evidence and need a decision you can trust and inspect.

---

## What I'm actually showing

Most "AI decisions" today are one big LLM prompt that reasons in prose and hands back an answer you can't inspect or trust at scale. That's fine for drafting; it's wrong for **routing, triage, risk, and prioritization**, where you need a *bounded* answer, a *calibrated confidence*, low latency, and an audit trail.

The **intervention layer** separates two jobs that should never be mixed:

```
   EVIDENCE / STATE            THE INTERVENTION LAYER               ACTION
 ────────────────────      ────────────────────────────      ───────────────────
  structured facts     →   ┌ Jev: bounded judgments ──┐   →   the chosen
  signals, history         │   Choice · Score · Noul   │       intervention
  a short explanation      │   over one shared STATE   │   →   + reason codes
                           └ Code: policy + human rules┘   →   + who to escalate to
                                       ▲                              │
                                       └────── feedback loop ─────────┘
                                        (did the intervention work?)
```

- **Jev writes the judgments** — fast, probabilistic, one of a fixed set or a number on a defined scale. Never prose.
- **Your code makes the decision** — thresholds, overrides, "don't act when unsure," escalate to a human. This is the "smart if-statement" layer.

LearnPath is one instance of this layer. **The layer is the point.**

---

## Where the same layer applies (wherever you can use Jev)

Swap the *state* and the *judgments*; the layer is identical. Each row is the same three columns — evidence in, bounded Jev judgments, an inspectable intervention out:

| Domain | State (evidence in) | Jev judgments (Choice / Score / Noul) | Intervention (decision out) |
|---|---|---|---|
| **Education** *(this demo)* | assessment items, prerequisite check, student's words | likely need · per-skill mastery · at-risk? ready? | prerequisite revision / guided practice / re-explain / *ask for more* |
| **Customer support** | ticket text + account history | intent · severity · refund-likelihood · frustration | auto-resolve / route to team / escalate to human |
| **Payments & fraud risk** | transaction features, 15-min SR window | anomaly? · risk tier · fraud-likelihood | allow / step-up verify / block / human review |
| **Merchant onboarding (KYC)** | website text, submitted docs | MCC category · risky-keyword? · name-match | fast-approve / manual review / reject |
| **Content moderation** | a post or review | violation type · severity · confidence | publish / limit / send to review |
| **Sales & ops** | lead / deal state | fit · urgency · churn-risk | next best action / prioritize / drop |

> These aren't hypothetical — they're exactly the bounded, high-volume, latency-sensitive decisions Jev is built for (SR-anomaly detection, MCC classification, risky-keyword checks, Indian name-matching were the motivating fintech cases). LearnPath proves the layer end-to-end on one of them so the pattern is obvious.

---

## Why Jev, not a general LLM

A routing/triage decision needs two things from **one fast, cheap call**: a **bounded answer** and a **calibrated confidence** in it. An LLM is a next-token predictor — you'd have to force it onto a label, parse prose, and trust a confidence it was never trained to calibrate, paying System-2 cost every time. **Jev is a System-1 decision model: the output *is* the decision, with probabilities you can threshold.**

LearnPath composes four of TypeSafe's own documented patterns:

| Pattern | In the layer |
|---|---|
| **Speculative Fan-Out** | all questions in one call over one state; code keeps the relevant answers |
| **Intent Routing** | a Choice routes to one of N intervention handlers — or to a human |
| **Confidence-Gated Routing** | confidence is a *second axis*: low → ask/escalate; high → act |
| **Composite Scoring** | per-dimension Scores, normalized and combined in code |

Full write-up: [`docs/LearnPath-Technical-Doc.md`](docs/LearnPath-Technical-Doc.md).

---

## The worked example: a Water-Cycle diagnostic

Two Grade-5 students can both score **40%** for different reasons — one is missing a prerequisite (evaporation), another understands the stages but can't apply them, a third holds a specific misconception. The same score hides different problems, so the right **intervention** is different for each.

The demo has two surfaces, both driven by the same layer:

- **Diagnostic** — one student at a time: same 40% → a different, inspectable decision with reason codes.
- **Teacher cohort** — the whole class at a glance: per-skill **mastery radar**, who's ready, who's at risk, which misconception, with a "gather more evidence first" path when the evidence is thin.

**The decision is made by code, not the model** (`lib/learnpath.ts`):

1. Thin evidence → never prescribe; ask one diagnostic question.
2. A *directly-observed* failed prerequisite check overrides a non-prerequisite guess from Jev.
3. Contradiction (Jev says "gap" but the prerequisite check is strong) → flag for teacher review.
4. Weak evidence strength or low choice confidence → flag for teacher review.

---

## The self-improving eval loop (`eval/`)

The layer is only as good as it is *accurate*, so LearnPath ships a deterministic harness that measures that accuracy and agents that improve it — **editing only the decision flow, never the rest of the app.**

- **Score.** Each gold-labelled scenario runs through the real flow, scored on `likelyNeed` (0.6), `intervention` (0.25), `needsTeacherReview` (0.15). Prints a confusion matrix; appends to [`eval/reports/scoreboard.md`](eval/reports/scoreboard.md).
- **Deterministic backends.** `demo` (offline heuristic), `cache` (real Jev recorded once and replayed, so only rule edits move the score), `live`.
- **No-overfit guards.** A hidden **holdout** split, a **surface guard** (`git status` must show only `lib/learnpath.ts`), a **lint** rejecting hard-coded student ids/names, and a two-split **baseline** the accept gate refuses to run without.
- **Agents (`.claude/`, mirrored in `.agents/`, `.codex/`).** `project-context`, `write-checks`, and `build` (the only agent allowed to edit the flow), driven by `/improve-flow` and the accept gate.

```bash
npm run eval:demo      # score the flow offline (deterministic)
npm run test           # harness + api-guard unit tests
npm run eval:baseline  # record the two-split baseline the gate guards
npm run eval:gate      # surface + lint + typecheck + no-regression gate
```

Current accuracy on the gold set (demo backend): **100%** — see the scoreboard and [`eval/README.md`](eval/README.md).

---

## Architecture

```
lib/data.ts        the domain: state shape, interventions, seed cases (pure, no I/O)
lib/learnpath.ts   the intervention layer — Jev questions + deterministic decision
lib/jev.ts         provider-agnostic Jev client (server-side key; typesafe/vercel/openrouter/aimlapi)
lib/api-guard.ts   rate limiting + input bounding for the API routes
app/api/*          recommend (one case) and cohort (all cases) routes
app/*              the two UI surfaces (diagnostic + teacher cohort), SVG charts
eval/              the accuracy harness, gold scenarios, scoreboard
.claude/ .agents/ .codex/   the improvement agents + skills (cross-harness)
docs/              the technical doc + a presentation deck
```

The layer is deliberately small: to retarget it to support/fraud/KYC you change `lib/data.ts` (state + interventions) and the question/rule set in `lib/learnpath.ts`. `lib/jev.ts` and the harness stay as-is.

---

## Security

The API routes proxy a **paid** Jev key, so they are rate-limited, bound to a known cohort by default (`ALLOW_CUSTOM_EVIDENCE` to open up), and never leak provider error detail to clients. The key is read **server-side only** and is never committed (`.gitignore` excludes `.env*`). See [`SECURITY.md`](SECURITY.md).

---

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. **Without a key it runs a clearly-labelled demo** (synthetic judgments, never presented as real Jev output).

### Wire a real Jev key

Put it in `learnpath/.env.local` (gitignored, server-side only):

```
JEV_API_KEY=apikey_your_key_here
JEV_PROVIDER=typesafe      # typesafe (direct) | vercel | openrouter | aimlapi
```

Confirm a real call:

```bash
npm run verify:jev
```

> Windows PowerShell note: it doesn't support `&&`. Run commands on separate lines or join with `;`.

---

## Status

Live against the real Jev model (`jev-1.13.0`, ~300 ms/decision). Public repo with CI on every push/PR (`typecheck → tests → eval → build`), `main` branch-protected to require that check. Accuracy harness at **100%** on the gold set.

---

*Jev returns structured probabilities (System 1). The intervention layer's own code applies thresholds and human-review rules to make the final, inspectable decision — in a classroom here, in support, payments, or onboarding next.*
