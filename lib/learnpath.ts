/**
 * LearnPath decision logic — Water Cycle diagnostic for Grade 5.
 *
 * The principle (straight from the Jev talk): the decision model writes
 * judgments, but a "smart if-statement" — our own tested code — makes the final
 * decision. Jev interprets the evidence; LearnPath selects the intervention
 * using explicit, inspectable rules, and never lets a model's guess silently
 * override a directly-observed result.
 *
 * Server-only: imports the Jev client (reads the API key from the environment).
 */

import { decide, type JevAnswer, type JevQuestion, type JevResult } from "./jev";
import {
  INTERVENTIONS,
  MASTERY_LEVELS,
  MASTERY_SKILLS,
  NEED_TO_INTERVENTION,
  SCORE_LEVELS,
  SKILL_LABELS,
  avgMastery,
  buildProfileSummary,
  deriveProfileFlags,
  evidenceSignals,
  type LearningNeed,
  type Recommendation,
  type SkillId,
  type StudentEvidence,
  type StudentProfile,
} from "./data";

export * from "./data";

// ----------------------------------------------------------------------------
// Jev question set — several bounded judgments over one shared state
// ----------------------------------------------------------------------------

export function buildQuestions(): JevQuestion[] {
  return [
    {
      id: "likely_need",
      kind: "choice",
      instructions:
        "Based only on the supplied evidence, which learning need best explains the student's performance on the water cycle?",
      options: {
        prerequisite_gap: "Missing a building-block idea such as evaporation (heat turns water into invisible vapour).",
        conceptual_misunderstanding:
          "Holds a specific wrong mental model of how the cycle works (e.g. clouds 'fill up like a sponge').",
        application_difficulty: "Understands the stages but cannot apply them to explain a real situation.",
        insufficient_evidence: "The evidence is too thin or contradictory to identify a specific need.",
      },
    },
    {
      id: "evidence_strength",
      kind: "score",
      instructions: "How strongly does the supplied evidence support the learning need you selected?",
      levels: [...SCORE_LEVELS],
    },
    {
      id: "enough_evidence",
      kind: "boolean",
      instructions:
        "Is there enough evidence to recommend a specific intervention WITHOUT asking another diagnostic question?",
      criteria: {
        true: "Item results, a prerequisite check, and/or a clear explanation point consistently to one need.",
        false: "Only an overall score, no explanation, or signals that contradict each other.",
      },
    },
    {
      id: "serious_prerequisite_gap",
      kind: "boolean",
      instructions:
        "Is there clear evidence of a prerequisite gap (evaporation) that should be fixed before anything else?",
      criteria: {
        true: "The student fails evaporation checks or cannot say water becomes invisible vapour.",
        false: "Evaporation basics look secure.",
      },
    },
  ];
}

// ----------------------------------------------------------------------------
// Deterministic decision — Jev informs, our code decides
// ----------------------------------------------------------------------------

const ENOUGH_EVIDENCE_THRESHOLD = 0.5;
const LOW_CONFIDENCE_CHOICE = 0.6;
const WEAK_EVIDENCE_SCORE = 2; // index into SCORE_LEVELS: below "moderate"
const PREREQ_FAIL = 40;
const PREREQ_SECURE = 70;

export function decideRecommendation(e: StudentEvidence, jev: JevResult): Recommendation {
  const reasons: string[] = [];

  const need = jev.answers.likely_need as Extract<JevAnswer, { kind: "choice" }> | undefined;
  const strength = jev.answers.evidence_strength as Extract<JevAnswer, { kind: "score" }> | undefined;
  const enough = jev.answers.enough_evidence as Extract<JevAnswer, { kind: "boolean" }> | undefined;
  const seriousGap = jev.answers.serious_prerequisite_gap as Extract<JevAnswer, { kind: "boolean" }> | undefined;

  let likelyNeed = (need?.choice as LearningNeed) || "insufficient_evidence";
  const topProb = need?.probabilities?.[likelyNeed] ?? 0;

  // --- Rule 1: thin evidence -> never prescribe, ask for more. -------------
  const signals = evidenceSignals(e);
  const enoughProb = enough?.probability ?? 0;
  if (signals <= 1 || enoughProb < ENOUGH_EVIDENCE_THRESHOLD) {
    reasons.push(
      signals <= 1
        ? `Only ${signals} source of evidence beyond the score — too thin to diagnose.`
        : `Jev judges the evidence insufficient to prescribe (p=${enoughProb.toFixed(2)}).`,
    );
    likelyNeed = "insufficient_evidence";
  }

  // --- Rule 2: a FAILED prerequisite check overrides a non-prerequisite ----
  //           guess. Don't let the model talk us past a directly-observed fail.
  if (e.prerequisiteCheck && e.prerequisiteCheck.score < PREREQ_FAIL && likelyNeed !== "insufficient_evidence") {
    if (likelyNeed !== "prerequisite_gap") {
      reasons.push(
        `Observed prerequisite check failed (${e.prerequisiteCheck.score}%) — this overrides Jev's "${likelyNeed}" and routes to prerequisite revision.`,
      );
    } else {
      reasons.push(`Prerequisite check failed (${e.prerequisiteCheck.score}%), consistent with Jev.`);
    }
    likelyNeed = "prerequisite_gap";
  }

  // --- Rule 3: contradiction -> flag for review + collect more. ------------
  let contradiction = false;
  if (likelyNeed === "prerequisite_gap" && e.prerequisiteCheck && e.prerequisiteCheck.score >= PREREQ_SECURE) {
    contradiction = true;
    reasons.push(
      `Jev says prerequisite gap, but the prerequisite check is strong (${e.prerequisiteCheck.score}%). Contradiction — collecting more evidence.`,
    );
    likelyNeed = "insufficient_evidence";
  }

  // --- Rule 4: conflicting signals -> flag for review. ---------------------
  //   Strong prerequisite but multiple downstream failures and no real
  //   explanation is genuinely ambiguous; don't prescribe blindly.
  const uninformative =
    e.explanation.trim() === "" || /not sure|don'?t know|idk|dunno|no idea/i.test(e.explanation);
  const downstreamWrong = e.items.filter((i) => i.skill !== "evaporation_basics" && !i.correct).length;
  let conflict = false;
  if (
    likelyNeed !== "insufficient_evidence" &&
    e.prerequisiteCheck &&
    e.prerequisiteCheck.score >= PREREQ_SECURE &&
    downstreamWrong >= 2 &&
    uninformative
  ) {
    conflict = true;
    reasons.push(
      `Strong prerequisite check (${e.prerequisiteCheck.score}%) but ${downstreamWrong} later skills failed with no clear explanation — conflicting evidence. Gathering more rather than prescribing, and flagged for review.`,
    );
    // Conflicting evidence is not a diagnosis: gather more instead of prescribing
    // a specific need (mirrors the contradiction branch above).
    likelyNeed = "insufficient_evidence";
  }

  // --- Confidence / teacher-review gating ----------------------------------
  const strengthLevelIdx = Math.max(0, Math.min(SCORE_LEVELS.length - 1, Math.round(strength?.score ?? 0)));
  const weakEvidence = (strength?.score ?? 0) < WEAK_EVIDENCE_SCORE;
  const lowConfidence = topProb > 0 && topProb < LOW_CONFIDENCE_CHOICE;

  let needsTeacherReview = contradiction || conflict;
  if (likelyNeed !== "insufficient_evidence") {
    if (weakEvidence) {
      needsTeacherReview = true;
      reasons.push(`Evidence strength is ${SCORE_LEVELS[strengthLevelIdx]} — flagged for teacher review.`);
    }
    if (lowConfidence) {
      needsTeacherReview = true;
      reasons.push(`Jev's top choice is low-confidence (p=${topProb.toFixed(2)}) — flagged for teacher review.`);
    }
  }

  if (reasons.length === 0) {
    reasons.push(
      `Evidence consistently indicates "${likelyNeed}" (p=${topProb.toFixed(2)}), with ${signals} supporting sources.`,
    );
  }

  return {
    studentId: e.id,
    studentName: e.name,
    score: e.score,
    likelyNeed,
    needProbabilities: need?.probabilities ?? {},
    evidenceStrength: {
      label: SCORE_LEVELS[strengthLevelIdx],
      score: strength?.score ?? 0,
      probabilities: strength?.probabilities ?? {},
    },
    enoughEvidenceProbability: enoughProb,
    seriousPrerequisiteGapProbability: seriousGap?.probability ?? 0,
    intervention: INTERVENTIONS[NEED_TO_INTERVENTION[likelyNeed]],
    needsTeacherReview,
    reasons,
    jev: { source: jev.source, model: jev.model, latencyMs: jev.latencyMs },
  };
}

/** Run the full pipeline: build questions, call Jev, apply deterministic logic. */
export async function recommend(e: StudentEvidence, signal?: AbortSignal): Promise<Recommendation> {
  const jev = await decide(e, buildQuestions(), { signal });
  return decideRecommendation(e, jev);
}

// ----------------------------------------------------------------------------
// Demo fallback — CLEARLY LABELED. Never presented as a real Jev response.
// Used only when no API key is configured (offline dev / safety net).
// ----------------------------------------------------------------------------

export function demoJev(e: StudentEvidence): JevResult {
  const prereq = e.prerequisiteCheck?.score ?? null;
  const wrongCount = e.items.filter((i) => !i.correct).length;
  const signals = evidenceSignals(e);
  const expl = e.explanation.toLowerCase();

  let need: LearningNeed = "insufficient_evidence";
  const probs: Record<LearningNeed, number> = {
    prerequisite_gap: 0.1,
    conceptual_misunderstanding: 0.1,
    application_difficulty: 0.1,
    insufficient_evidence: 0.1,
  };

  if (signals <= 1) {
    need = "insufficient_evidence";
    probs.insufficient_evidence = 0.86;
  } else if (prereq !== null && prereq < PREREQ_FAIL) {
    need = "prerequisite_gap";
    probs.prerequisite_gap = 0.9;
  } else if (/(sponge|fill|heavy|smoke|soak)/.test(expl)) {
    need = "conceptual_misunderstanding";
    probs.conceptual_misunderstanding = 0.82;
  } else if (
    (prereq === null || prereq >= PREREQ_SECURE) &&
    e.items.some((i) => i.skill === "apply_real_world" && !i.correct)
  ) {
    need = "application_difficulty";
    probs.application_difficulty = 0.8;
  } else if (wrongCount >= 2) {
    need = "conceptual_misunderstanding";
    probs.conceptual_misunderstanding = 0.58; // deliberately low-confidence
  }

  const sum = Object.values(probs).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(probs) as LearningNeed[]) probs[k] = +(probs[k] / sum).toFixed(2);

  // Evidence strength tracks the model's confidence in its chosen need.
  const topP = probs[need];
  const strengthScore =
    need === "insufficient_evidence" ? 0.6 : topP >= 0.8 ? 3.4 : topP >= 0.7 ? 2.8 : 1.5;
  const enoughP = signals <= 1 ? 0.18 : 0.86;
  const seriousP = prereq !== null && prereq < PREREQ_FAIL ? 0.92 : 0.12;

  const answers: Record<string, JevAnswer> = {
    likely_need: { kind: "choice", choice: need, probabilities: probs, confidence: probs[need] },
    evidence_strength: {
      kind: "score",
      score: strengthScore,
      levels: [...SCORE_LEVELS],
      probabilities: scoreProbs(strengthScore),
      confidence: 0.7,
    },
    enough_evidence: { kind: "boolean", probability: enoughP },
    serious_prerequisite_gap: { kind: "boolean", probability: seriousP },
  };

  return { source: "demo", model: "demo-heuristic (not Jev)", latencyMs: 3, answers };
}

function scoreProbs(score: number): Record<string, number> {
  const idx = Math.max(0, Math.min(SCORE_LEVELS.length - 1, Math.round(score)));
  const out: Record<string, number> = {};
  SCORE_LEVELS.forEach((_, i) => {
    const d = Math.abs(i - idx);
    out[String(i)] = +(d === 0 ? 0.7 : d === 1 ? 0.14 : 0.01).toFixed(2);
  });
  return out;
}

// ============================================================================
// UNDERSTANDING PROFILE — a batch of bounded Jev judgments per student that
// together form a "propensity vector" (per-skill mastery + ready + at-risk).
// ============================================================================

export function buildProfileQuestions(): JevQuestion[] {
  const masteryQs: JevQuestion[] = MASTERY_SKILLS.map((skill) => ({
    id: `mastery_${skill}`,
    kind: "score" as const,
    instructions: `How well has the student mastered ${SKILL_LABELS[skill].toLowerCase()} in the water cycle, based on the evidence?`,
    levels: [...MASTERY_LEVELS],
  }));

  return [
    {
      id: "likely_need",
      kind: "choice",
      instructions:
        "Based only on the supplied evidence, which learning need best explains the student's performance on the water cycle?",
      options: {
        prerequisite_gap: "Missing a building-block idea such as evaporation (heat turns water into invisible vapour).",
        conceptual_misunderstanding:
          "Holds a specific wrong mental model of how the cycle works (e.g. clouds 'fill up like a sponge').",
        application_difficulty: "Understands the stages but cannot apply them to explain a real situation.",
        insufficient_evidence: "The evidence is too thin or contradictory to identify a specific need.",
      },
    },
    ...masteryQs,
    {
      id: "ready_to_advance",
      kind: "boolean",
      instructions: "Is the student ready to advance to the next skill in the water cycle?",
      criteria: {
        true: "Secure across the stages and able to apply them.",
        false: "Still has gaps, misconceptions, or cannot apply the ideas.",
      },
    },
    {
      id: "at_risk",
      kind: "boolean",
      instructions: "Is this student at risk of falling behind without targeted support?",
      criteria: {
        true: "Low mastery, a blocking prerequisite gap, or persistent errors.",
        false: "Progressing acceptably with normal instruction.",
      },
    },
    // --- Targeted misconception / application judgments (speculative fan-out).
    //     Narrow questions return sharper probabilities and pinpoint the exact
    //     wrong model, not just a generic "misunderstanding".
    {
      id: "mc_water_gone",
      kind: "boolean",
      instructions:
        "Does the student believe evaporated water simply disappears or is 'gone', rather than becoming invisible water vapour?",
      criteria: {
        true: "Talks about water vanishing / disappearing, with no idea of vapour.",
        false: "Describes water changing into (invisible) vapour.",
      },
    },
    {
      id: "mc_cloud_sponge",
      kind: "boolean",
      instructions:
        "Does the student hold the misconception that clouds fill up with water like a sponge and spill rain, rather than droplets forming by condensation?",
      criteria: {
        true: "Uses a 'sponge / fills up / gets too heavy' model of clouds.",
        false: "Describes vapour condensing into droplets that join and fall.",
      },
    },
    {
      id: "can_apply",
      kind: "boolean",
      instructions:
        "Can the student apply the water cycle to explain a NEW real-world situation (e.g. why a puddle dries on a sunny day, why dew forms)?",
      criteria: {
        true: "Applies the stages correctly to an unfamiliar case.",
        false: "Cannot connect the stages to a real situation.",
      },
    },
  ];
}

const MASTERY_SPAN = MASTERY_LEVELS.length - 1;

export function computeProfile(e: StudentEvidence, jev: JevResult): StudentProfile {
  const need = jev.answers.likely_need as Extract<JevAnswer, { kind: "choice" }> | undefined;
  const likelyNeed = (need?.choice as LearningNeed) || "insufficient_evidence";

  const mastery = {} as Record<SkillId, number>;
  for (const skill of MASTERY_SKILLS) {
    const a = jev.answers[`mastery_${skill}`] as Extract<JevAnswer, { kind: "score" }> | undefined;
    const v = (a?.score ?? 0) / MASTERY_SPAN;
    mastery[skill] = Math.max(0, Math.min(1, v));
  }

  const bool = (id: string) =>
    (jev.answers[id] as Extract<JevAnswer, { kind: "boolean" }> | undefined)?.probability ?? 0;

  const ready = bool("ready_to_advance");
  const atRisk = bool("at_risk");
  const misconceptionWaterGone = bool("mc_water_gone");
  const misconceptionCloudSponge = bool("mc_cloud_sponge");
  const canApply = bool("can_apply");

  // Enrich the summary with the strongest detected misconception, if decisive.
  let summary = buildProfileSummary(e.name, likelyNeed, mastery, ready, atRisk);
  const detected = [
    { label: "believes evaporated water is simply 'gone'", p: misconceptionWaterGone },
    { label: "holds the 'clouds fill like a sponge' model", p: misconceptionCloudSponge },
  ].sort((a, b) => b.p - a.p)[0];
  if (detected.p >= 0.6) summary += ` Detected misconception — ${detected.label} (p=${detected.p.toFixed(2)}).`;

  return {
    studentId: e.id,
    studentName: e.name,
    score: e.score,
    likelyNeed,
    needProbabilities: need?.probabilities ?? {},
    mastery,
    readyToAdvance: ready,
    atRisk,
    misconceptionWaterGone,
    misconceptionCloudSponge,
    canApply,
    flags: deriveProfileFlags(likelyNeed, mastery, ready, atRisk),
    summary,
    jev: { source: jev.source, model: jev.model, latencyMs: jev.latencyMs },
  };
}

/** Full profile pipeline for one student. */
export async function profileFor(e: StudentEvidence, signal?: AbortSignal): Promise<StudentProfile> {
  const jev = await decide(e, buildProfileQuestions(), { signal });
  return computeProfile(e, jev);
}

/** Clearly-labeled demo profile (no API key). Never presented as real Jev. */
export function demoProfileJev(e: StudentEvidence): JevResult {
  const base = demoJev(e); // reuse the need heuristic
  const answers: Record<string, JevAnswer> = { likely_need: base.answers.likely_need };

  for (const skill of MASTERY_SKILLS) {
    let s: number; // 0..MASTERY_SPAN
    if (skill === "evaporation_basics" && e.prerequisiteCheck) {
      s = (e.prerequisiteCheck.score / 100) * MASTERY_SPAN;
    } else {
      const item = e.items.find((i) => i.skill === skill);
      s = item ? (item.correct ? 2.6 : 0.6) : 1.4;
    }
    answers[`mastery_${skill}`] = {
      kind: "score",
      score: s,
      levels: [...MASTERY_LEVELS],
      probabilities: masteryProbs(s),
      confidence: 0.7,
    };
  }

  const mastery = {} as Record<SkillId, number>;
  for (const skill of MASTERY_SKILLS) mastery[skill] = (answers[`mastery_${skill}`] as { score: number }).score / MASTERY_SPAN;
  const avg = avgMastery(mastery);
  const need = (base.answers.likely_need as Extract<JevAnswer, { kind: "choice" }>).choice as LearningNeed;
  const prereqFail = e.prerequisiteCheck !== null && e.prerequisiteCheck.score < 40;

  const ready = need === "insufficient_evidence" ? 0.18 : avg >= 0.6 ? 0.72 : 0.28;
  const atRisk = prereqFail || avg < 0.45 ? 0.76 : 0.2;

  answers.ready_to_advance = { kind: "boolean", probability: ready };
  answers.at_risk = { kind: "boolean", probability: atRisk };

  // Targeted misconception / application signals from the explanation + items.
  const expl = e.explanation.toLowerCase();
  const applied = e.items.find((i) => i.skill === "apply_real_world");
  answers.mc_water_gone = { kind: "boolean", probability: /(disappear|gone|vanish)/.test(expl) ? 0.86 : 0.08 };
  answers.mc_cloud_sponge = { kind: "boolean", probability: /(sponge|fill|soak|heavy)/.test(expl) ? 0.84 : 0.07 };
  answers.can_apply = {
    kind: "boolean",
    probability:
      applied?.correct || e.appliedTaskResult === "correct" ? 0.82 : applied && !applied.correct ? 0.12 : 0.4,
  };

  return { source: "demo", model: "demo-heuristic (not Jev)", latencyMs: 3, answers };
}

function masteryProbs(score: number): Record<string, number> {
  const idx = Math.max(0, Math.min(MASTERY_SPAN, Math.round(score)));
  const out: Record<string, number> = {};
  MASTERY_LEVELS.forEach((_, i) => {
    const d = Math.abs(i - idx);
    out[String(i)] = +(d === 0 ? 0.68 : d === 1 ? 0.15 : 0.01).toFixed(2);
  });
  return out;
}
