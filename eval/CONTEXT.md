# LearnPath — Flow Context (maintained by the project-context agent)

_Last refreshed from the committed flow + `eval/reports/latest.json`. Facts only; no fixes proposed._

## 1. Domain
- **Skills (prerequisite → application):** evaporation_basics, condensation, precipitation, apply_real_world.
- **Learning needs:** prerequisite_gap, conceptual_misunderstanding, application_difficulty, insufficient_evidence.
- **Interventions (`NEED_TO_INTERVENTION`):** prerequisite_gap→prerequisite_revision, conceptual_misunderstanding→alternative_explanation, application_difficulty→guided_application, insufficient_evidence→ask_diagnostic.

## 2. Invariants (never violate)
- **Jev informs, code decides.** `decideRecommendation()` makes the final call from Jev's judgments; a model guess never silently overrides a directly-observed result.
- **Observed prerequisite fail overrides a guess.** A failed evaporation check routes to prerequisite_gap regardless of Jev's choice.
- **Thin evidence never prescribes.** ≤1 evidence signal, or low `enough_evidence`, → insufficient_evidence / ask_diagnostic.
- **Contradictory/conflicting evidence → gather more, flag for review.** Don't prescribe a specific need when signals genuinely conflict.

## 3. Editable surface (accuracy changes)
**ONLY `lib/learnpath.ts`** — the Jev question set (`buildQuestions()`) and the deterministic thresholds/rules in `decideRecommendation()`. Everything else is frozen.

Current thresholds (verbatim):
- `ENOUGH_EVIDENCE_THRESHOLD = 0.5`
- `LOW_CONFIDENCE_CHOICE = 0.6`
- `WEAK_EVIDENCE_SCORE = 2`
- `PREREQ_FAIL = 40`
- `PREREQ_SECURE = 70`

## 4. Current behavior (one line per rule)
- **Rule 1 (thin evidence):** `evidenceSignals ≤ 1` OR `enough_evidence < 0.5` → force insufficient_evidence.
- **Rule 2 (prereq override):** observed prerequisite `< 40` → force prerequisite_gap (overrides a non-prereq Jev choice).
- **Rule 3 (contradiction):** Jev says prerequisite_gap but observed prereq `≥ 70` → force insufficient_evidence + review.
- **Rule 4 (conflict):** non-insufficient need, prereq `≥ 70`, ≥2 downstream skills wrong, uninformative explanation → route to insufficient_evidence (gather more) AND set review=true. _(Iteration 1 changed this from "flag but keep the need" to "gather more", mirroring Rule 3.)_
- **Confidence gating:** weak evidence (`strength < 2`) or low top choice prob (`0 < p < 0.6`) → review=true (only when a specific need is chosen).

## 5. Known failure modes (from latest.json — backend=demo, split=all, score 100.00% after iteration 1)
- **No failing cases.** All 7 seed + 2 holdout cases are full passes on the demo backend.
- **dev — now PASS** (was the pre-iteration-1 failure). Rule 4 routes its contradictory evidence (strong prereq 85% + ≥2 downstream failures + uninformative "I'm not sure") to insufficient_evidence/ask_diagnostic/review=true, matching the gold label.
- Next targets must come from new scenarios (write-checks) or the `cache`/`live` backends, where real Jev may disagree with the demo heuristic.

## 6. Open label questions
- **priya** — secure across all stages, but the 4-way need Choice has no "on track" option, so the recommend flow routes a no-problem student to insufficient_evidence. Labeled to CURRENT behavior and tracked as a limitation (spec §5.6); not a build-agent tuning target until the product decides whether "secure/ready" is a diagnosable outcome.
