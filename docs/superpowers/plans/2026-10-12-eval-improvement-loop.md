# LearnPath Eval-Driven Improvement Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic eval harness plus three agents/skills and an orchestrator that iteratively raise LearnPath's diagnostic accuracy, editing only `lib/learnpath.ts`.

**Architecture:** A Node+TypeScript harness (`eval/`, run via `tsx`) scores the real flow (`buildQuestions` + `decideRecommendation`) against gold-labeled scenarios using one of three Jev-answer backends (demo/cache/live). Three Claude Code subagents (project-context, write-checks, build) with skills, driven by an `/improve-flow` orchestrator, run the loop under an accept gate that forbids edits outside `lib/learnpath.ts`, forbids hard-coded scenario ids, and rejects train/holdout regressions.

**Tech Stack:** TypeScript, Node 22 built-in `node:test` + `node:assert/strict`, `tsx` (dev dependency) for running `.ts`, git for the surface guard. No runtime dependencies added.

**Spec:** `docs/superpowers/specs/2026-10-12-eval-improvement-loop-design.md`

## Global Constraints

- Accuracy-improvement edits may touch **only** `lib/learnpath.ts`. (Spec §3.) New infrastructure files under `eval/`, `.claude/`, `docs/` are additive and are not "the flow".
- No new **runtime** dependencies. `tsx` is a **devDependency** only. (Spec §5.1.)
- Scoring weights are fixed and live in one place: `likelyNeed` 0.6, `intervention.id` 0.25, `needsTeacherReview` 0.15. (Spec §5.2.)
- `cache` backend must **fail loudly** on missing/stale cache — never silently fall back to live or demo. (Spec §5.3, §9.)
- The harness imports the real flow from `../lib/learnpath`; there is exactly one implementation of the flow. (Spec §4.)
- Node runs with `tsx`: tests via `node --import tsx --test <files…>`; scripts via `tsx eval/<file>.ts`.
- **Import convention (verified against this repo's `tsconfig`):** all imports in `eval/**` use **extensionless** specifiers (e.g. `from "./scoring"`, `from "../lib/learnpath"`). The `tsconfig` uses `moduleResolution: "bundler"` with `allowImportingTsExtensions` OFF and `include: **/*.ts`, so `tsc --noEmit` (run by the gate) **errors TS5097 on `.ts` import extensions** but accepts extensionless ones; `tsx` resolves extensionless `.ts` at runtime. Do not add `.ts` to import paths.
- **Test imports:** use `import { test } from "node:test";` (named) and `import assert from "node:assert/strict";`.
- **CLI entry guard:** a module that is both imported and run as a CLI (`run.ts`, `gate.ts`) must guard its `main()`/CLI block with `if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)`, so importing it from a test does not execute it.
- Platform: Windows PowerShell 5.1 for the human; no `&&` chaining in PowerShell. Bash tool available for POSIX. Commit messages end with the attribution line in the Commit step.
- The build agent is **never shown** holdout scenario contents. (Spec §5.4.)

## Review Focus

- **Stale cache after a question-set change** — `buildQuestions()` changes, the `questionsHash` no longer matches any cache file; a `cache` run must abort with the exact `eval:record` command, not score against stale/partial data. (Covered: Task 5 cache-miss test.)
- **A flow edit that helps train but hurts holdout** — the accept gate must reject it; without this the loop overfits. (Covered: Task 7 `gateVerdict` holdout-regression test.)
- **A disguised hard-coded id** — e.g. `name.toLowerCase() === "aarav"` or a `"meera"` literal in a new branch; the lint must catch quoted ids/names in added diff lines. (Covered: Task 3 lint test.)
- **An edit outside the surface sneaking in** — a "helpful" tweak to `lib/data.ts` or `lib/jev.ts` alongside a `lib/learnpath.ts` change; surface guard must fail the whole iteration. (Covered: Task 3 surface-guard test.)
- **An empty or single-scenario split** — `aggregate([])` must return 0, not `NaN`, so a mis-filtered split fails visibly rather than poisoning the scoreboard. (Covered: Task 2 aggregate-empty test.)

---

## Phase 1 — The Eval Harness

### Task 1: Project setup — tsx, scripts, eval skeleton

**Files:**
- Modify: `package.json` (scripts + devDependencies)
- Create: `eval/reports/scoreboard.md`
- Create: `eval/jev-cache/.gitkeep`
- Create: `.gitignore` entry note (verify `eval/reports/latest.json` is NOT ignored)

**Interfaces:**
- Produces: npm scripts `eval`, `eval:train`, `eval:holdout`, `eval:demo`, `eval:live`, `eval:record`, `test:eval`; `tsx` available.

- [ ] **Step 1: Install tsx as a dev dependency**

Run (Bash tool):
```bash
cd "C:/Users/jeswi/Desktop/Projects/Jev Hackathon/learnpath" && npm install -D tsx@^4
```
Expected: `tsx` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Verify tsx can import the real flow**

Run:
```bash
npx tsx -e "import('./lib/learnpath.ts').then(m => console.log(typeof m.buildQuestions, typeof m.decideRecommendation, typeof m.demoJev))"
```
Expected: `function function function`

- [ ] **Step 3: Add npm scripts to `package.json`**

Add to the `"scripts"` block (keep existing entries):
```json
    "eval": "tsx eval/run.ts --backend cache --split all",
    "eval:train": "tsx eval/run.ts --backend cache --split train",
    "eval:holdout": "tsx eval/run.ts --backend cache --split holdout",
    "eval:demo": "tsx eval/run.ts --backend demo --split all",
    "eval:live": "tsx --env-file=.env.local eval/run.ts --backend live --split all",
    "eval:record": "tsx --env-file=.env.local eval/record.ts",
    "eval:gate": "tsx eval/gate.ts",
    "test:eval": "node --import tsx --test eval/scoring.test.ts eval/guards.test.ts eval/scenarios.test.ts eval/backends.test.ts eval/run.test.ts eval/gate.test.ts"
```

- [ ] **Step 4: Create the scoreboard seed and cache placeholder**

`eval/reports/scoreboard.md`:
```markdown
# LearnPath Flow Scoreboard

Append-only history of accuracy iterations. Newest at the bottom.
Score = weighted accuracy (need 0.6 / intervention 0.25 / review 0.15), %.

| # | date (UTC) | backend | split | score | Δ | note |
|---|------------|---------|-------|-------|---|------|
```

`eval/jev-cache/.gitkeep`:
```
# recorded Jev responses live here, keyed <scenarioId>.<questionsHash>.json
```

- [ ] **Step 5: Verify reports are tracked**

Run:
```bash
cd "C:/Users/jeswi/Desktop/Projects/Jev Hackathon/learnpath" && git check-ignore eval/reports/latest.json; echo "exit=$?"
```
Expected: `exit=1` (NOT ignored). If it prints a path, remove the matching rule or add `!eval/reports/latest.json` to `.gitignore`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json eval/reports/scoreboard.md eval/jev-cache/.gitkeep
git commit -m "chore(eval): harness skeleton — tsx, npm scripts, scoreboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Types and scoring (pure, TDD)

**Files:**
- Create: `eval/types.ts`
- Create: `eval/scoring.ts`
- Test: `eval/scoring.test.ts`

**Interfaces:**
- Consumes: `LearningNeed`, `InterventionId`, `StudentEvidence` from `../lib/data`.
- Produces:
  - `ExpectedLabel = { likelyNeed: LearningNeed; interventionId: InterventionId; needsTeacherReview: boolean }`
  - `Actual = { likelyNeed: LearningNeed; interventionId: InterventionId; needsTeacherReview: boolean }`
  - `Scenario = { id: string; evidence: StudentEvidence; expected: ExpectedLabel; rationale: string; holdout?: boolean }`
  - `Split = "all" | "train" | "holdout"`, `Backend = "demo" | "cache" | "live"`
  - `CaseResult = { id; expected; actual; needMatch; interventionMatch; reviewMatch; score; reasons: string[] }`
  - `RunReport = { timestamp; backend; split; score; cases: CaseResult[]; confusion: Record<string,Record<string,number>>; regressions: string[] }`
  - `WEIGHTS = { need: 0.6, intervention: 0.25, review: 0.15 }`
  - `scoreCase(id, actual, expected, reasons): CaseResult`
  - `aggregate(cases: CaseResult[]): number` (0..100, 2 dp)
  - `confusionMatrix(cases: CaseResult[]): Record<string,Record<string,number>>`
  - `regressionsVs(prev: RunReport | null, cases: CaseResult[]): string[]`

- [ ] **Step 1: Write `eval/types.ts`**

```ts
import type { InterventionId, LearningNeed, StudentEvidence } from "../lib/data";

export type Split = "all" | "train" | "holdout";
export type Backend = "demo" | "cache" | "live";

export type ExpectedLabel = {
  likelyNeed: LearningNeed;
  interventionId: InterventionId;
  needsTeacherReview: boolean;
};

export type Actual = ExpectedLabel;

export type Scenario = {
  id: string;
  evidence: StudentEvidence;
  expected: ExpectedLabel;
  /** Short written justification for the expected label. */
  rationale: string;
  /** true => held-out split, hidden from the build agent. */
  holdout?: boolean;
};

export type CaseResult = {
  id: string;
  expected: ExpectedLabel;
  actual: Actual;
  needMatch: boolean;
  interventionMatch: boolean;
  reviewMatch: boolean;
  score: number; // 0..1
  reasons: string[];
};

export type RunReport = {
  timestamp: string;
  backend: Backend;
  split: Split;
  score: number; // 0..100
  cases: CaseResult[];
  confusion: Record<string, Record<string, number>>;
  regressions: string[];
};
```

- [ ] **Step 2: Write the failing test `eval/scoring.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { WEIGHTS, scoreCase, aggregate, confusionMatrix, regressionsVs } from "./scoring";
import type { CaseResult } from "./types";

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
```
(Add `import type { RunReport } from "./types";` at the top alongside the CaseResult import.)

- [ ] **Step 3: Run the test, verify it fails**

Run: `node --import tsx --test eval/scoring.test.ts`
Expected: FAIL — `scoring.ts` not found / exports undefined.

- [ ] **Step 4: Write `eval/scoring.ts`**

```ts
import type { CaseResult, Actual, ExpectedLabel, RunReport } from "./types";

export const WEIGHTS = { need: 0.6, intervention: 0.25, review: 0.15 } as const;

export function scoreCase(id: string, actual: Actual, expected: ExpectedLabel, reasons: string[]): CaseResult {
  const needMatch = actual.likelyNeed === expected.likelyNeed;
  const interventionMatch = actual.interventionId === expected.interventionId;
  const reviewMatch = actual.needsTeacherReview === expected.needsTeacherReview;
  const score =
    (needMatch ? WEIGHTS.need : 0) +
    (interventionMatch ? WEIGHTS.intervention : 0) +
    (reviewMatch ? WEIGHTS.review : 0);
  return { id, expected, actual, needMatch, interventionMatch, reviewMatch, score: +score.toFixed(4), reasons };
}

export function aggregate(cases: CaseResult[]): number {
  if (cases.length === 0) return 0;
  const mean = cases.reduce((a, c) => a + c.score, 0) / cases.length;
  return +(mean * 100).toFixed(2);
}

export function confusionMatrix(cases: CaseResult[]): Record<string, Record<string, number>> {
  const m: Record<string, Record<string, number>> = {};
  for (const c of cases) {
    const e = c.expected.likelyNeed;
    const a = c.actual.likelyNeed;
    (m[e] ??= {})[a] = ((m[e] ??= {})[a] ?? 0) + 1;
  }
  return m;
}

export function regressionsVs(prev: RunReport | null, cases: CaseResult[]): string[] {
  if (!prev) return [];
  const prevById = new Map(prev.cases.map((c) => [c.id, c.score]));
  return cases.filter((c) => (prevById.get(c.id) ?? 0) > c.score).map((c) => c.id);
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `node --import tsx --test eval/scoring.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 6: Commit**

```bash
git add eval/types.ts eval/scoring.ts eval/scoring.test.ts
git commit -m "feat(eval): scoring core — weighted scoreCase, aggregate, confusion

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Guards — surface + no-special-casing lint (pure, TDD)

**Files:**
- Create: `eval/guards.ts`
- Test: `eval/guards.test.ts`

**Interfaces:**
- Produces:
  - `surfaceGuard(changedFiles: string[], allowed?: string[]): { ok: boolean; offending: string[] }` (default allowed = `["lib/learnpath.ts"]`)
  - `noSpecialCasingLint(addedLines: string[], forbidden: string[]): { ok: boolean; hits: string[] }`

- [ ] **Step 1: Write the failing test `eval/guards.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { surfaceGuard, noSpecialCasingLint } from "./guards";

test("surfaceGuard: only lib/learnpath.ts passes", () => {
  assert.deepEqual(surfaceGuard(["lib/learnpath.ts"]), { ok: true, offending: [] });
});

test("surfaceGuard: any other file fails and is reported", () => {
  const r = surfaceGuard(["lib/learnpath.ts", "lib/data.ts"]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offending, ["lib/data.ts"]);
});

test("noSpecialCasingLint: quoted scenario id in added line is a hit", () => {
  const r = noSpecialCasingLint(['  if (e.id === "aarav") return "prerequisite_gap";'], ["aarav", "meera"]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.hits, ["aarav"]);
});

test("noSpecialCasingLint: case-insensitive name match", () => {
  const r = noSpecialCasingLint(["  if (name === 'Meera') {"], ["aarav", "meera"]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.hits, ["meera"]);
});

test("noSpecialCasingLint: a legitimate threshold change is clean", () => {
  const r = noSpecialCasingLint(["  const PREREQ_FAIL = 45;"], ["aarav", "meera"]);
  assert.deepEqual(r, { ok: true, hits: [] });
});

test("noSpecialCasingLint: forbidden token only as substring (not quoted) is clean", () => {
  const r = noSpecialCasingLint(["  // devise a better rule"], ["dev"]);
  assert.deepEqual(r, { ok: true, hits: [] });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `node --import tsx --test eval/guards.test.ts`
Expected: FAIL — `guards.ts` not found.

- [ ] **Step 3: Write `eval/guards.ts`**

```ts
export function surfaceGuard(
  changedFiles: string[],
  allowed: string[] = ["lib/learnpath.ts"],
): { ok: boolean; offending: string[] } {
  const offending = changedFiles.filter((f) => f.trim() !== "" && !allowed.includes(f.trim()));
  return { ok: offending.length === 0, offending };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function noSpecialCasingLint(
  addedLines: string[],
  forbidden: string[],
): { ok: boolean; hits: string[] } {
  const hits = new Set<string>();
  for (const tok of forbidden) {
    if (!tok) continue;
    const re = new RegExp(`["'\`]${escapeRegExp(tok)}["'\`]`, "i");
    for (const line of addedLines) {
      if (re.test(line)) hits.add(tok.toLowerCase());
    }
  }
  return { ok: hits.size === 0, hits: [...hits] };
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `node --import tsx --test eval/guards.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add eval/guards.ts eval/guards.test.ts
git commit -m "feat(eval): accept-gate guards — surface + no-special-casing lint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Gold scenarios — seed, holdout, loader (TDD)

**Files:**
- Create: `eval/scenarios/seed.ts`
- Create: `eval/scenarios/holdout.ts`
- Create: `eval/scenarios/index.ts`
- Test: `eval/scenarios.test.ts`

**Interfaces:**
- Consumes: `getStudent`, `STUDENTS`, `StudentEvidence` from `../../lib/data`; `Scenario`, `Split` from `../types.ts`.
- Produces:
  - `SEED: Scenario[]` (the 7 students, labeled)
  - `HOLDOUT: Scenario[]` (new cases, `holdout: true`)
  - `loadScenarios(split: Split): Scenario[]`
  - `forbiddenTokens(): string[]` — all scenario ids + student names, for the lint

- [ ] **Step 1: Write `eval/scenarios/seed.ts`**

```ts
import { getStudent, type StudentEvidence } from "../../lib/data";
import type { Scenario } from "../types";

function ev(id: string): StudentEvidence {
  const s = getStudent(id);
  if (!s) throw new Error(`seed scenario references unknown student "${id}"`);
  return s;
}

export const SEED: Scenario[] = [
  {
    id: "aarav",
    evidence: ev("aarav"),
    expected: { likelyNeed: "prerequisite_gap", interventionId: "prerequisite_revision", needsTeacherReview: false },
    rationale: "Fails the evaporation prerequisite check (25%) and cannot say where water goes — a missing building block.",
  },
  {
    id: "meera",
    evidence: ev("meera"),
    expected: { likelyNeed: "application_difficulty", interventionId: "guided_application", needsTeacherReview: false },
    rationale: "Secure on the stages (prereq 85%, items correct) but cannot apply them to a puddle drying — application difficulty.",
  },
  {
    id: "rohan",
    evidence: ev("rohan"),
    expected: { likelyNeed: "conceptual_misunderstanding", interventionId: "alternative_explanation", needsTeacherReview: false },
    rationale: "Explicit 'clouds fill like a sponge' misconception with a secure prerequisite — a specific wrong mental model.",
  },
  {
    id: "sana",
    evidence: ev("sana"),
    expected: { likelyNeed: "insufficient_evidence", interventionId: "ask_diagnostic", needsTeacherReview: false },
    rationale: "Only an overall score, no items/prereq/explanation — too thin to diagnose; ask, don't guess.",
  },
  {
    id: "dev",
    evidence: ev("dev"),
    expected: { likelyNeed: "insufficient_evidence", interventionId: "ask_diagnostic", needsTeacherReview: true },
    rationale: "Strong prerequisite (85%) but several later failures and an uninformative 'I'm not sure' — contradictory; gather more and flag for review.",
  },
  {
    id: "priya",
    evidence: ev("priya"),
    expected: { likelyNeed: "insufficient_evidence", interventionId: "ask_diagnostic", needsTeacherReview: false },
    rationale: "KNOWN FLOW LIMITATION: Priya is secure across all stages, but the 4-way need Choice has no 'on track' option, so the recommend flow routes her to insufficient_evidence. Labeled to CURRENT behavior and tracked as a limitation (see spec §5.6), not a tuning target for the build agent.",
  },
  {
    id: "kabir",
    evidence: ev("kabir"),
    expected: { likelyNeed: "application_difficulty", interventionId: "guided_application", needsTeacherReview: false },
    rationale: "Solid basics (evaporation + condensation correct, prereq 78%) but fails precipitation and the applied task — cannot yet apply the later stages.",
  },
];
```

- [ ] **Step 2: Write `eval/scenarios/holdout.ts`**

```ts
import type { StudentEvidence } from "../../lib/data";
import type { Scenario } from "../types";

const nina: StudentEvidence = {
  id: "nina",
  name: "Nina",
  score: 38,
  items: [
    { skill: "evaporation_basics", correct: false },
    { skill: "condensation", correct: false },
    { skill: "precipitation", correct: false },
    { skill: "apply_real_world", correct: false },
  ],
  prerequisiteCheck: { skill: "evaporation_basics", score: 20 },
  explanation: "The water just goes away. I don't know where.",
  appliedTaskResult: "not_tested",
};

const omar: StudentEvidence = {
  id: "omar",
  name: "Omar",
  score: 48,
  items: [
    { skill: "evaporation_basics", correct: true },
    { skill: "condensation", correct: false },
    { skill: "precipitation", correct: false },
    { skill: "apply_real_world", correct: false },
  ],
  prerequisiteCheck: { skill: "evaporation_basics", score: 75 },
  explanation: "Clouds fill up like a sponge and when they get too heavy the rain spills out.",
  appliedTaskResult: "not_tested",
};

export const HOLDOUT: Scenario[] = [
  {
    id: "nina",
    evidence: nina,
    expected: { likelyNeed: "prerequisite_gap", interventionId: "prerequisite_revision", needsTeacherReview: false },
    rationale: "Clear prerequisite gap — fails evaporation (20%), water 'goes away'. Held out.",
    holdout: true,
  },
  {
    id: "omar",
    evidence: omar,
    expected: { likelyNeed: "conceptual_misunderstanding", interventionId: "alternative_explanation", needsTeacherReview: false },
    rationale: "Clear 'sponge' misconception with a secure prerequisite (75%). Held out.",
    holdout: true,
  },
];
```

- [ ] **Step 3: Write `eval/scenarios/index.ts`**

```ts
import { STUDENTS } from "../../lib/data";
import type { Scenario, Split } from "../types";
import { SEED } from "./seed";
import { HOLDOUT } from "./holdout";

const ALL: Scenario[] = [...SEED, ...HOLDOUT];

export function loadScenarios(split: Split): Scenario[] {
  if (split === "train") return ALL.filter((s) => !s.holdout);
  if (split === "holdout") return ALL.filter((s) => s.holdout);
  return ALL;
}

/** Ids and student names that must never appear as string literals in lib/learnpath.ts. */
export function forbiddenTokens(): string[] {
  const ids = ALL.map((s) => s.id);
  const names = [...STUDENTS.map((s) => s.name), ...ALL.map((s) => s.evidence.name)];
  return [...new Set([...ids, ...names])];
}

export { SEED, HOLDOUT };
```

- [ ] **Step 4: Write the test `eval/scenarios.test.ts`**

```ts
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
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `node --import tsx --test eval/scenarios.test.ts`
Expected: PASS. (The need→intervention consistency test will catch any mislabel.)

- [ ] **Step 6: Commit**

```bash
git add eval/scenarios/
git add eval/scenarios.test.ts
git commit -m "feat(eval): gold scenarios — 7 seed + 2 holdout, loader, forbidden tokens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Backends — demo, cache, questionsHash (TDD)

**Files:**
- Create: `eval/backends.ts`
- Test: `eval/backends.test.ts`

**Interfaces:**
- Consumes: `buildQuestions`, `demoJev` from `../lib/learnpath.ts`; `decide`, `JevResult` from `../lib/jev.ts`; `StudentEvidence` from `../lib/data.ts`; `Backend` from `./types.ts`.
- Produces:
  - `questionsHash(): string` (12-hex of the current recommend question set)
  - `cachePath(id: string): string`
  - `getJevResult(backend: Backend, evidence: StudentEvidence): Promise<JevResult>`
  - `CacheMissError` (thrown by cache backend with the `eval:record` hint)

- [ ] **Step 1: Write the failing test `eval/backends.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { questionsHash, getJevResult, CacheMissError } from "./backends";
import { getStudent } from "../lib/data";

test("questionsHash is a stable 12-hex string", () => {
  const h = questionsHash();
  assert.match(h, /^[0-9a-f]{12}$/);
  assert.equal(h, questionsHash());
});

test("demo backend returns a demo-sourced JevResult with the recommend answers", async () => {
  const r = await getJevResult("demo", getStudent("aarav")!);
  assert.equal(r.source, "demo");
  assert.ok(r.answers.likely_need);
  assert.ok(r.answers.enough_evidence);
});

test("cache backend throws CacheMissError when no file recorded", async () => {
  await assert.rejects(
    () => getJevResult("cache", getStudent("sana")!),
    (e: unknown) => e instanceof CacheMissError && /eval:record/.test((e as Error).message),
  );
});
```
(This assumes no cache file for `sana` at the current hash exists yet — true before Task 7 records.)

- [ ] **Step 2: Run the test, verify it fails**

Run: `node --import tsx --test eval/backends.test.ts`
Expected: FAIL — `backends.ts` not found.

- [ ] **Step 3: Write `eval/backends.ts`**

```ts
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildQuestions, demoJev } from "../lib/learnpath";
import { decide, type JevResult } from "../lib/jev";
import type { StudentEvidence } from "../lib/data";
import type { Backend } from "./types";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(HERE, "jev-cache");

export function questionsHash(): string {
  return createHash("sha256").update(JSON.stringify(buildQuestions())).digest("hex").slice(0, 12);
}

export function cachePath(id: string): string {
  return join(CACHE_DIR, `${id}.${questionsHash()}.json`);
}

export class CacheMissError extends Error {
  constructor(id: string, path: string) {
    super(
      `No recorded Jev response for "${id}" at questions hash ${questionsHash()} (expected ${path}). ` +
        `Run \`npm run eval:record\` to (re)record after a question-set change.`,
    );
    this.name = "CacheMissError";
  }
}

export async function getJevResult(backend: Backend, evidence: StudentEvidence): Promise<JevResult> {
  if (backend === "demo") return demoJev(evidence);
  if (backend === "cache") {
    const p = cachePath(evidence.id);
    if (!existsSync(p)) throw new CacheMissError(evidence.id, p);
    return JSON.parse(readFileSync(p, "utf8")) as JevResult;
  }
  return decide(evidence, buildQuestions());
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `node --import tsx --test eval/backends.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add eval/backends.ts eval/backends.test.ts
git commit -m "feat(eval): Jev backends — demo/cache/live + questionsHash, loud cache miss

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Runner — score a split, write report, append scoreboard (TDD)

**Files:**
- Create: `eval/run.ts`
- Test: `eval/run.test.ts`

**Interfaces:**
- Consumes: `loadScenarios` (`./scenarios/index.ts`), `getJevResult` (`./backends.ts`), `decideRecommendation` (`../lib/learnpath.ts`), `scoreCase/aggregate/confusionMatrix/regressionsVs` (`./scoring.ts`), types.
- Produces:
  - `runEval(backend: Backend, split: Split): Promise<RunReport>` (pure of CLI; no file writes)
  - `writeReport(report: RunReport, note: string): void` (writes `reports/latest.json`, appends `reports/scoreboard.md`)
  - `formatReport(report: RunReport): string` (human table + confusion matrix + SCORE line)
  - CLI entry (runs when invoked directly): parses `--backend`, `--split`, `--note`, prints `formatReport`, calls `writeReport` unless `--no-write`.

- [ ] **Step 1: Write the test `eval/run.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { runEval } from "./run";

test("runEval(demo, all): Dev is the only failing seed case at baseline", async () => {
  const report = await runEval("demo", "all");
  const dev = report.cases.find((c) => c.id === "dev")!;
  assert.equal(dev.needMatch, false, "Dev's need is misclassified by the baseline flow");
  // Every other case is a full pass at baseline on the demo backend.
  const others = report.cases.filter((c) => c.id !== "dev");
  assert.ok(others.every((c) => c.score === 1), "all non-Dev cases pass at baseline");
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
```
> Note: this test encodes the **baseline** behavior derived from the current `lib/learnpath.ts` + `demoJev` (see spec §5.6 worked-through). If a non-Dev case does not pass at baseline, do NOT edit the flow to force it — instead re-examine that scenario's expected label with the write-checks discipline and fix the label or mark it a tracked limitation, because Task 6 is about the harness, not tuning.

- [ ] **Step 2: Write `eval/run.ts`**

```ts
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { decideRecommendation } from "../lib/learnpath";
import { loadScenarios } from "./scenarios/index";
import { getJevResult } from "./backends";
import { aggregate, confusionMatrix, regressionsVs, scoreCase } from "./scoring";
import type { Backend, CaseResult, RunReport, Split } from "./types";

const HERE = dirname(fileURLToPath(import.meta.url));
const LATEST = join(HERE, "reports", "latest.json");
const SCOREBOARD = join(HERE, "reports", "scoreboard.md");

function readLatest(): RunReport | null {
  if (!existsSync(LATEST)) return null;
  try {
    return JSON.parse(readFileSync(LATEST, "utf8")) as RunReport;
  } catch {
    return null;
  }
}

export async function runEval(backend: Backend, split: Split): Promise<RunReport> {
  const scenarios = loadScenarios(split);
  const cases: CaseResult[] = [];
  for (const s of scenarios) {
    const jev = await getJevResult(backend, s.evidence);
    const rec = decideRecommendation(s.evidence, jev);
    const actual = {
      likelyNeed: rec.likelyNeed,
      interventionId: rec.intervention.id,
      needsTeacherReview: rec.needsTeacherReview,
    };
    cases.push(scoreCase(s.id, actual, s.expected, rec.reasons));
  }
  const prev = readLatest();
  return {
    timestamp: new Date().toISOString(),
    backend,
    split,
    score: aggregate(cases),
    cases,
    confusion: confusionMatrix(cases),
    regressions: regressionsVs(prev && prev.split === split ? prev : null, cases),
  };
}

export function formatReport(r: RunReport): string {
  const lines: string[] = [];
  lines.push(`\nLearnPath flow — backend=${r.backend} split=${r.split}`);
  lines.push("─".repeat(64));
  for (const c of r.cases) {
    const marks = `${c.needMatch ? "N" : "·"}${c.interventionMatch ? "I" : "·"}${c.reviewMatch ? "R" : "·"}`;
    const flag = c.score === 1 ? "PASS" : "FAIL";
    lines.push(
      `  ${flag}  ${c.id.padEnd(8)} ${marks}  exp=${c.expected.likelyNeed}  got=${c.actual.likelyNeed}  (${c.score.toFixed(2)})`,
    );
  }
  lines.push("─".repeat(64));
  lines.push("  confusion (expected → actual need):");
  for (const [exp, row] of Object.entries(r.confusion)) {
    const parts = Object.entries(row).map(([a, n]) => `${a}×${n}`);
    lines.push(`    ${exp.padEnd(26)} ${parts.join(", ")}`);
  }
  if (r.regressions.length) lines.push(`  ⚠ regressions: ${r.regressions.join(", ")}`);
  lines.push(`\n  SCORE: ${r.score.toFixed(2)}%  (${r.cases.length} cases)\n`);
  return lines.join("\n");
}

export function writeReport(r: RunReport, note: string): void {
  const prev = readLatest();
  const delta = prev && prev.split === r.split ? +(r.score - prev.score).toFixed(2) : null;
  const d = delta === null ? "—" : delta >= 0 ? `+${delta}` : `${delta}`;
  const n = countRows() + 1;
  writeFileSync(LATEST, JSON.stringify(r, null, 2));
  const when = r.timestamp.slice(0, 19).replace("T", " ");
  const row = `| ${n} | ${when} | ${r.backend} | ${r.split} | ${r.score.toFixed(2)} | ${d} | ${note || "—"} |\n`;
  appendFileSync(SCOREBOARD, row);
}

function countRows(): number {
  if (!existsSync(SCOREBOARD)) return 0;
  const body = readFileSync(SCOREBOARD, "utf8").split("\n");
  // rows after the header separator line that start with "| " and a digit
  return body.filter((l) => /^\|\s*\d+\s*\|/.test(l)).length;
}

function parseArgs(argv: string[]) {
  const get = (flag: string, def: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
  };
  return {
    backend: get("--backend", "demo") as Backend,
    split: get("--split", "all") as Split,
    note: get("--note", ""),
    write: !argv.includes("--no-write"),
  };
}

// CLI entry — only when run directly, not when imported by a test.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { backend, split, note, write } = parseArgs(process.argv.slice(2));
  runEval(backend, split).then((r) => {
    process.stdout.write(formatReport(r));
    if (write) writeReport(r, note);
  });
}
```
- [ ] **Step 3: Run the test, verify it passes**

Run: `node --import tsx --test eval/run.test.ts`
Expected: PASS (3 tests). This confirms the baseline: Dev fails on `need`, everything else is a full pass, holdout is 100%.

- [ ] **Step 4: Smoke-run the CLI and record the first baseline row**

Run:
```bash
cd "C:/Users/jeswi/Desktop/Projects/Jev Hackathon/learnpath" && npx tsx eval/run.ts --backend demo --split all --note "baseline (demo backend)"
```
Expected: a printed table with `FAIL dev`, SCORE ≈ `90.56%` (all split = 9 cases: 8 full passes + Dev at 0.15), `reports/latest.json` written, one row appended to `scoreboard.md`. (The `train` split alone is ≈`87.86%` = 6.15/7.)

- [ ] **Step 5: Commit**

```bash
git add eval/run.ts eval/run.test.ts eval/reports/latest.json eval/reports/scoreboard.md
git commit -m "feat(eval): runner — score split, confusion, report + scoreboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Recorder + accept gate (pure `gateVerdict` + CLI wiring, TDD)

**Files:**
- Create: `eval/record.ts`
- Create: `eval/gate.ts`
- Test: `eval/gate.test.ts`
- Create: `eval/README.md`

**Interfaces:**
- Consumes: `loadScenarios`, `getJevResult` (live), `questionsHash`, `cachePath`, `surfaceGuard`, `noSpecialCasingLint`, `forbiddenTokens`, `runEval`.
- Produces:
  - `record.ts` CLI: live Jev pass over all scenarios → writes `jev-cache/<id>.<hash>.json`; prints hash + count. Fails with guidance if no key.
  - `gateVerdict(input): { ok: boolean; failures: string[] }` — **pure** decision over `{ changedFiles, addedLines, forbidden, typecheckOk, trainScore, trainBase, holdoutScore, holdoutBase }`. Testable without git/tsc.
  - `gate.ts` CLI: gathers real inputs (git diff, tsc, train/holdout via `runEval`), calls `gateVerdict`, prints the verdict, exits non-zero on any failure. Reads the pre-change baseline from `reports/latest.json`.

- [ ] **Step 1: Write `eval/record.ts`**

```ts
import { writeFileSync } from "node:fs";
import { buildQuestions } from "../lib/learnpath";
import { decide } from "../lib/jev";
import { loadScenarios } from "./scenarios/index";
import { cachePath, questionsHash } from "./backends";

async function main() {
  const scenarios = loadScenarios("all");
  const hash = questionsHash();
  console.log(`Recording ${scenarios.length} scenarios at questions hash ${hash} …`);
  let ok = 0;
  for (const s of scenarios) {
    const jev = await decide(s.evidence, buildQuestions());
    writeFileSync(cachePath(s.id), JSON.stringify(jev, null, 2));
    console.log(`  ✓ ${s.id}  (${jev.latencyMs}ms, model=${jev.model})`);
    ok++;
  }
  console.log(`Recorded ${ok}/${scenarios.length} at hash ${hash}.`);
}

main().catch((e) => {
  console.error(`✗ record failed: ${e?.message || e}`);
  console.error("  (cache recording needs a Jev key — run via `npm run eval:record`.)");
  process.exit(1);
});
```

- [ ] **Step 2: Write `eval/gate.ts` (pure `gateVerdict` + CLI wiring)**

```ts
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { surfaceGuard, noSpecialCasingLint } from "./guards";
import { forbiddenTokens } from "./scenarios/index";
import { runEval } from "./run";
import type { RunReport } from "./types";

export type GateInput = {
  changedFiles: string[];
  addedLines: string[];
  forbidden: string[];
  typecheckOk: boolean;
  trainScore: number;
  trainBase: number;
  holdoutScore: number;
  holdoutBase: number;
};

/** Pure accept-gate decision. No git, no tsc, no fs — fully unit-testable. */
export function gateVerdict(i: GateInput): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const sg = surfaceGuard(i.changedFiles);
  if (!sg.ok) failures.push(`edits outside lib/learnpath.ts: ${sg.offending.join(", ")}`);
  const lint = noSpecialCasingLint(i.addedLines, i.forbidden);
  if (!lint.ok) failures.push(`hard-coded scenario id/name in flow: ${lint.hits.join(", ")}`);
  if (!i.typecheckOk) failures.push("tsc --noEmit reported type errors");
  if (i.trainScore < i.trainBase) failures.push(`train regressed ${i.trainBase} → ${i.trainScore}`);
  if (i.holdoutScore < i.holdoutBase) failures.push(`holdout regressed ${i.holdoutBase} → ${i.holdoutScore}`);
  return { ok: failures.length === 0, failures };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const LATEST = join(HERE, "reports", "latest.json");

function sh(cmd: string): string {
  return execSync(cmd, { encoding: "utf8" });
}

function changedFiles(): string[] {
  return sh("git diff --name-only HEAD").split("\n").map((s) => s.trim()).filter(Boolean);
}

function addedLines(): string[] {
  const diff = sh("git diff HEAD -- lib/learnpath.ts");
  return diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
}

function prevBaseline(split: "train" | "holdout"): number {
  if (!existsSync(LATEST)) return 0;
  try {
    const r = JSON.parse(readFileSync(LATEST, "utf8")) as RunReport;
    return r.split === split ? r.score : 0;
  } catch {
    return 0;
  }
}

async function main() {
  let typecheckOk = true;
  try {
    sh("npm run -s typecheck");
  } catch {
    typecheckOk = false;
  }
  const train = await runEval("demo", "train");
  const holdout = await runEval("demo", "holdout");

  const verdict = gateVerdict({
    changedFiles: changedFiles(),
    addedLines: addedLines(),
    forbidden: forbiddenTokens(),
    typecheckOk,
    trainScore: train.score,
    trainBase: prevBaseline("train"),
    holdoutScore: holdout.score,
    holdoutBase: prevBaseline("holdout"),
  });

  if (!verdict.ok) {
    for (const f of verdict.failures) console.error(`✗ GATE FAIL — ${f}`);
    process.exit(1);
  }
  console.log(`✓ GATE PASS — train ${train.score}% · holdout ${holdout.score}%`);
}

// Only run as a CLI; importing gateVerdict from a test must not trigger this.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
```
> Note: the gate uses the **demo** backend for determinism when run offline. With a Jev key + recorded cache, the orchestrator may additionally re-run train/holdout on `cache` for the real signal; the regression logic is identical. `gateVerdict` is pure so it is tested directly (Step 3). The gate reads the *pre-change* baseline from `latest.json`, so the orchestrator must record the baseline BEFORE the build agent edits the flow.

- [ ] **Step 3: Write the failing test `eval/gate.test.ts`**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { gateVerdict } from "./gate";

const base = {
  changedFiles: ["lib/learnpath.ts"],
  addedLines: ["  const PREREQ_FAIL = 45;"],
  forbidden: ["aarav", "meera", "dev"],
  typecheckOk: true,
  trainScore: 90,
  trainBase: 88,
  holdoutScore: 100,
  holdoutBase: 100,
};

test("gateVerdict: clean improving change passes", () => {
  assert.deepEqual(gateVerdict(base), { ok: true, failures: [] });
});

test("gateVerdict: edit outside the surface fails", () => {
  const v = gateVerdict({ ...base, changedFiles: ["lib/learnpath.ts", "lib/data.ts"] });
  assert.equal(v.ok, false);
  assert.ok(v.failures.some((f) => f.includes("lib/data.ts")));
});

test("gateVerdict: hard-coded id fails", () => {
  const v = gateVerdict({ ...base, addedLines: ['  if (e.id === "dev") …'] });
  assert.equal(v.ok, false);
  assert.ok(v.failures.some((f) => f.includes("dev")));
});

test("gateVerdict: holdout regression fails even if train rose", () => {
  const v = gateVerdict({ ...base, trainScore: 95, holdoutScore: 90, holdoutBase: 100 });
  assert.equal(v.ok, false);
  assert.ok(v.failures.some((f) => f.includes("holdout regressed")));
});

test("gateVerdict: typecheck failure fails", () => {
  const v = gateVerdict({ ...base, typecheckOk: false });
  assert.equal(v.ok, false);
  assert.ok(v.failures.some((f) => f.includes("tsc")));
});
```

- [ ] **Step 4: Run the gate test, verify it passes**

Run: `node --import tsx --test eval/gate.test.ts`
Expected: PASS (5 tests). (Write `gate.ts` Step 2 first; the test imports `gateVerdict` from it.)

- [ ] **Step 5: Write `eval/README.md`**

````markdown
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
````

- [ ] **Step 6: Commit (so the tree is clean before verifying the gate)**

```bash
git add eval/record.ts eval/gate.ts eval/gate.test.ts eval/README.md
git commit -m "feat(eval): recorder + pure accept gate (gateVerdict) + README

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 7: Verify the gate runs clean on the committed tree**

Run:
```bash
cd "C:/Users/jeswi/Desktop/Projects/Jev Hackathon/learnpath" && npx tsx eval/gate.ts; echo "gate exit=$?"
```
Expected: with the tree clean (no changes to `lib/learnpath.ts`), surface guard passes, typecheck passes, train/holdout meet baseline → `✓ GATE PASS`, `gate exit=0`.
> Note: `git diff --name-only HEAD` reports tracked changes only; untracked files (e.g. not-yet-committed eval files) do not trip the surface guard. If you run the gate with an uncommitted edit to `lib/learnpath.ts` present, that is exactly the case the guard is built for.

---

## Phase 2 — Agents, Skills & the Loop

> Phase 2 files are Claude Code config/instruction artifacts (Markdown with YAML
> frontmatter). Their "test" is structural: frontmatter parses, every path and
> skill they reference exists, and the orchestrator's steps map to real npm
> scripts/agents. Each task ends with a concrete verification, not a unit test.

### Task 8: project-context agent + learnpath-eval skill + CONTEXT.md

**Files:**
- Create: `.claude/agents/project-context.md`
- Create: `.claude/skills/learnpath-eval/SKILL.md`
- Create: `eval/CONTEXT.md`

**Interfaces:**
- Produces: a read-only subagent `project-context`; a skill `learnpath-eval`; a seed `eval/CONTEXT.md` the agent maintains.

- [ ] **Step 1: Write `.claude/agents/project-context.md`**

```markdown
---
name: project-context
description: Read-only. Refreshes eval/CONTEXT.md — the domain, invariants, editable surface, current flow behavior, and known failure modes — so every improvement iteration stays grounded. Dispatch at the start of /improve-flow.
tools: Read, Glob, Grep
model: sonnet
---

You are the **project-context** agent for LearnPath. You NEVER edit code. Your
one job is to (re)write `eval/CONTEXT.md` so the build and write-checks agents
act from current, accurate ground truth.

Read, each run:
- `lib/learnpath.ts` — `buildQuestions()` and `decideRecommendation()` (the flow).
- `lib/data.ts` — needs, interventions, `NEED_TO_INTERVENTION`, `evidenceSignals`, seed students, `SCENARIO_NOTES`.
- `eval/scenarios/seed.ts` and `eval/scenarios/holdout.ts` — gold labels + rationales.
- `eval/reports/latest.json` — the current score, per-case pass/fail, confusion matrix.
- `docs/superpowers/specs/2026-10-12-eval-improvement-loop-design.md` — the contract.

Then write `eval/CONTEXT.md` with these sections, concise and current:
1. **Domain** — the four skills, the four learning needs, the interventions.
2. **Invariants (never violate)** — "Jev informs, code decides"; a directly
   observed prerequisite fail overrides a model guess; thin evidence never
   prescribes (ask_diagnostic); contradictory/conflicting evidence is flagged
   for review and should gather more, not prescribe.
3. **Editable surface** — ONLY `lib/learnpath.ts` (questions + thresholds/rules).
   List the current thresholds and their values verbatim.
4. **Current behavior** — a 1-line summary of what each decide rule does now.
5. **Known failure modes** — read from `latest.json`: which scenarios fail and
   on which field (need/intervention/review), with the flow's own `reasons`.
6. **Open label questions** — e.g. Priya (secure student has no need option).

Do not propose fixes — that is the build agent's job. State facts only.
```

- [ ] **Step 2: Write `.claude/skills/learnpath-eval/SKILL.md`**

```markdown
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
```

- [ ] **Step 3: Generate the first `eval/CONTEXT.md`**

Dispatch the `project-context` agent (or, if executing natively, follow its
instructions yourself) to write `eval/CONTEXT.md` from the current repo +
`reports/latest.json`. Verify the file contains all six sections and that the
threshold values it lists match `lib/learnpath.ts` (`ENOUGH_EVIDENCE_THRESHOLD=0.5`,
`LOW_CONFIDENCE_CHOICE=0.6`, `WEAK_EVIDENCE_SCORE=2`, `PREREQ_FAIL=40`, `PREREQ_SECURE=70`).

- [ ] **Step 4: Validate frontmatter + references**

Run:
```bash
cd "C:/Users/jeswi/Desktop/Projects/Jev Hackathon/learnpath" && npx tsx -e "import {readFileSync} from 'node:fs'; for (const f of ['.claude/agents/project-context.md','.claude/skills/learnpath-eval/SKILL.md']) { const t=readFileSync(f,'utf8'); if(!t.startsWith('---')) throw new Error('no frontmatter: '+f); if(!/name:/.test(t)||!/description:/.test(t)) throw new Error('missing name/description: '+f); console.log('ok',f);} "
```
Expected: `ok .claude/agents/project-context.md` and `ok .claude/skills/learnpath-eval/SKILL.md`.

- [ ] **Step 5: Commit**

```bash
git add .claude/agents/project-context.md .claude/skills/learnpath-eval/SKILL.md eval/CONTEXT.md
git commit -m "feat(agents): project-context agent + learnpath-eval skill + CONTEXT

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: write-checks agent + writing-eval-checks skill

**Files:**
- Create: `.claude/agents/write-checks.md`
- Create: `.claude/skills/writing-eval-checks/SKILL.md`

**Interfaces:**
- Produces: a subagent `write-checks` (read + write `eval/scenarios/` only); a skill `writing-eval-checks`.

- [ ] **Step 1: Write `.claude/agents/write-checks.md`**

```markdown
---
name: write-checks
description: Authors new gold-labeled LearnPath scenarios into eval/scenarios/ (edge cases, adversarial evidence, the "same score, different evidence" hook) with a written label justification, and maintains the holdout split. Never edits lib/learnpath.ts.
tools: Read, Glob, Grep, Write
model: sonnet
---

You are the **write-checks** agent. You GROW the gold set; you NEVER edit the
flow (`lib/learnpath.ts`) and NEVER edit anything to make a failing case pass.

Invoke the `writing-eval-checks` skill and follow it. Read `eval/CONTEXT.md`
first for the invariants and the current failure modes.

Your edits are limited to `eval/scenarios/seed.ts` and
`eval/scenarios/holdout.ts`. For each new scenario:
- Build a realistic `StudentEvidence` (do not copy an existing id/name).
- Set `expected` from the EVIDENCE and the domain, not from what the flow
  currently outputs. If the evidence is genuinely ambiguous, either make it
  unambiguous or mark it a tracked limitation in the `rationale` — never guess.
- Write a one-to-two sentence `rationale` justifying the label.
- Put generalization cases (not variations of training cases) in `holdout.ts`.

After adding scenarios, state that `npm run eval:record` must be run before any
`cache`-backed score is trusted (the question set is unchanged, but new
scenarios have no cache yet). Do not run flow edits. Do not touch the holdout
balance to make the score look better.
```

- [ ] **Step 2: Write `.claude/skills/writing-eval-checks/SKILL.md`**

```markdown
---
name: writing-eval-checks
description: Use when adding or revising gold-labeled scenarios for the LearnPath eval set — how to pick a defensible expected label, avoid label leakage, cover edge cases, and keep a fair train/holdout split.
---

# Writing LearnPath Eval Checks

A gold scenario = a `StudentEvidence` + an `expected` label
(`likelyNeed`, `interventionId`, `needsTeacherReview`) + a `rationale`.

## Rules
1. **Label from evidence, not from the flow.** Decide what a careful teacher
   would conclude from the evidence. Never read `decideRecommendation` output
   and copy it — that just freezes current behavior.
2. **Intervention must match the need** via `NEED_TO_INTERVENTION` (the loader
   test enforces this). Set `interventionId` to the mapped value.
3. **needsTeacherReview = true** only for genuinely contradictory/conflicting
   or low-confidence evidence (e.g. strong prerequisite but several later fails
   with an uninformative explanation).
4. **No label leakage.** The evidence text must not contain the label words
   ("this is a prerequisite gap"). Keep it in a student's voice.
5. **Coverage.** Aim across all four needs, plus: thin evidence (ask), a
   directly-observed prerequisite fail that must override a model guess, and the
   signature "two students, same ~40% score, different evidence → different
   decision" pair.
6. **Holdout discipline.** New *generalization* cases (different surface form of
   a known need) go in `holdout.ts`; they are hidden from the build agent and
   guard against overfitting. Keep holdout labels unambiguous.
7. **Ambiguity** is documented in `rationale` as a tracked limitation, never
   silently guessed.

## After editing
New scenarios have no recorded Jev cache. Tell the operator to run
`npm run eval:record` before trusting a `cache` score. Never edit the flow.
```

- [ ] **Step 3: Validate frontmatter**

Run:
```bash
cd "C:/Users/jeswi/Desktop/Projects/Jev Hackathon/learnpath" && npx tsx -e "import {readFileSync} from 'node:fs'; for (const f of ['.claude/agents/write-checks.md','.claude/skills/writing-eval-checks/SKILL.md']) { const t=readFileSync(f,'utf8'); if(!t.startsWith('---')||!/name:/.test(t)||!/description:/.test(t)) throw new Error('bad frontmatter: '+f); console.log('ok',f);} "
```
Expected: two `ok` lines.

- [ ] **Step 4: Commit**

```bash
git add .claude/agents/write-checks.md .claude/skills/writing-eval-checks/SKILL.md
git commit -m "feat(agents): write-checks agent + writing-eval-checks skill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: build agent + improving-the-flow skill

**Files:**
- Create: `.claude/agents/build.md`
- Create: `.claude/skills/improving-the-flow/SKILL.md`

**Interfaces:**
- Produces: a subagent `build` (Read, Edit, Bash) — the only agent allowed to edit `lib/learnpath.ts`; a skill `improving-the-flow`.

- [ ] **Step 1: Write `.claude/agents/build.md`**

```markdown
---
name: build
description: The only agent allowed to edit lib/learnpath.ts. Forms ONE hypothesis from the current failing cases, changes only the flow (questions/thresholds/rules), and keeps the change only if the accept gate passes and no split regresses. Reverts otherwise.
tools: Read, Edit, Bash
model: sonnet
---

You are the **build** agent. You improve LearnPath's diagnostic accuracy by
editing ONLY `lib/learnpath.ts`. Invoke the `improving-the-flow` skill and
follow it exactly.

You are given: `eval/CONTEXT.md`, and the current failing cases from
`eval/reports/latest.json` for the **train** split only. You are NOT shown
holdout contents.

Loop for ONE change:
1. Read CONTEXT + the failing train cases and the flow's `reasons` for them.
2. State ONE hypothesis ("the conflict branch flags review but still prescribes
   a need; it should route to insufficient_evidence like the contradiction
   branch").
3. Make the minimal edit to `lib/learnpath.ts` that tests the hypothesis.
4. Run `npm run eval:gate`. It enforces: only `lib/learnpath.ts` changed, no
   hard-coded ids/names, `tsc` clean, and no train/holdout regression.
5. If the gate passes AND train score rose (or held while fixing a target),
   stop and report the diff + old→new score. If it fails, `git checkout --
   lib/learnpath.ts` to revert and either try a different minimal hypothesis or
   report that no safe improvement was found.

Never edit scenarios, data, the Jev client, or the UI. Never hard-code a student
id or name. Never accept a change that lowers any split.
```

- [ ] **Step 2: Write `.claude/skills/improving-the-flow/SKILL.md`**

```markdown
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
```

- [ ] **Step 3: Validate frontmatter**

Run:
```bash
cd "C:/Users/jeswi/Desktop/Projects/Jev Hackathon/learnpath" && npx tsx -e "import {readFileSync} from 'node:fs'; for (const f of ['.claude/agents/build.md','.claude/skills/improving-the-flow/SKILL.md']) { const t=readFileSync(f,'utf8'); if(!t.startsWith('---')||!/name:/.test(t)||!/description:/.test(t)) throw new Error('bad frontmatter: '+f); console.log('ok',f);} "
```
Expected: two `ok` lines.

- [ ] **Step 4: Commit**

```bash
git add .claude/agents/build.md .claude/skills/improving-the-flow/SKILL.md
git commit -m "feat(agents): build agent + improving-the-flow skill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: /improve-flow orchestrator command

**Files:**
- Create: `.claude/commands/improve-flow.md`

**Interfaces:**
- Consumes: the three agents, the gate, the runner.
- Produces: a slash command `/improve-flow` that runs one safe iteration.

- [ ] **Step 1: Write `.claude/commands/improve-flow.md`**

```markdown
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
```

- [ ] **Step 2: Validate the command references real targets**

Run:
```bash
cd "C:/Users/jeswi/Desktop/Projects/Jev Hackathon/learnpath" && npx tsx -e "import {readFileSync,existsSync} from 'node:fs'; const t=readFileSync('.claude/commands/improve-flow.md','utf8'); for (const a of ['project-context','write-checks','build']) if(!existsSync('.claude/agents/'+a+'.md')) throw new Error('missing agent '+a); if(!/eval\/gate\.ts|eval:gate/.test(t)) throw new Error('no gate ref'); console.log('ok improve-flow references all agents + gate');"
```
Expected: `ok improve-flow references all agents + gate`.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/improve-flow.md
git commit -m "feat(agents): /improve-flow orchestrator command

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: Demo — run the loop and show the score climb

**Files:**
- Modify: `lib/learnpath.ts` (the build agent's accepted change — the ONE editable file)
- Modify: `eval/reports/scoreboard.md`, `eval/reports/latest.json` (appended by the run)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Confirm the baseline is recorded**

Run:
```bash
cd "C:/Users/jeswi/Desktop/Projects/Jev Hackathon/learnpath" && npx tsx eval/run.ts --backend demo --split train --note "demo baseline (train)"
```
Expected: SCORE printed (train baseline, Dev failing). `latest.json` updated.

- [ ] **Step 2: Run one real improvement iteration**

Invoke `/improve-flow` (backend `demo`). The build agent should discover that the
**conflict** branch in `decideRecommendation` flags `needsTeacherReview` but
still prescribes a specific need, whereas Dev's contradictory evidence should
route to `insufficient_evidence` (gather more) — matching the gold label. The
minimal edit: in the conflict branch, set `likelyNeed = "insufficient_evidence"`
(leaving `needsTeacherReview = true`), mirroring the contradiction branch.

Do NOT hand-write this fix yourself as the implementer — let the build agent
produce it under the gate. If executing natively, follow the `build` agent +
`improving-the-flow` skill to produce exactly one minimal, gated change.

- [ ] **Step 3: Verify the gate passed and the score rose**

Run:
```bash
cd "C:/Users/jeswi/Desktop/Projects/Jev Hackathon/learnpath" && npm run -s test:eval; npx tsx eval/run.ts --backend demo --split all --note "fix: conflict routes to insufficient_evidence"
```
Expected: unit tests still pass; `dev` now `PASS`; SCORE rises from ≈90.56% to 100% on `all` (and ≈87.86% → 100% on `train`); `git diff --name-only HEAD` shows ONLY `lib/learnpath.ts` (plus `eval/reports/*`).
> If `test:eval`'s `run.test.ts` baseline assertion now fails because Dev passes, that is expected after the improvement — update that single assertion to reflect the improved baseline (Dev now passes) in the same commit, and note it. The test encodes the baseline, and the baseline has legitimately moved.

- [ ] **Step 4: Commit the accepted iteration**

```bash
git add lib/learnpath.ts eval/reports/latest.json eval/reports/scoreboard.md eval/run.test.ts
git commit -m "fix(flow): route contradictory evidence to insufficient_evidence

Iteration 1 via /improve-flow. Conflict branch now gathers more evidence
instead of prescribing. Score (demo, all) 90.56% -> 100%; only
lib/learnpath.ts changed; holdout held.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Report the scoreboard to the user**

Print `eval/reports/scoreboard.md` and summarize: baseline → iteration-1 score,
which case flipped to PASS, and confirmation that only `lib/learnpath.ts`
changed and holdout did not regress.

---

## Notes for Phase 3 (separate plan, not this one)

- `app/api/eval/route.ts` runtime self-grade endpoint (+ optional `/eval` panel).
- README rewrite and `docs/eval-methodology.md`.
- Recording the real Jev cache (`npm run eval:record`) and re-running the loop on
  the `cache` backend for a real-Jev iteration, once the key is confirmed.
