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
