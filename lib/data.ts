/**
 * Pure LearnPath data + types. No I/O, no secrets — safe to import from the
 * client page and the server alike. Water Cycle diagnostic for Grade 5.
 */

export const TOPIC = "water_cycle" as const;

/** The skills we probe, lowest (prerequisite) to highest (application). */
export const SKILLS = {
  evaporation_basics: "Heat turns liquid water into invisible water vapour (evaporation).",
  condensation: "Cooling water vapour forms tiny droplets that make clouds (condensation).",
  precipitation: "Droplets join, grow heavy, and fall as rain/snow (precipitation).",
  apply_real_world: "Using the cycle to explain real situations (a puddle drying, dew forming).",
} as const;

export const SKILL_LABELS: Record<SkillId, string> = {
  evaporation_basics: "Evaporation",
  condensation: "Condensation",
  precipitation: "Precipitation",
  apply_real_world: "Real-world application",
};

export type SkillId = keyof typeof SKILLS;

export type StudentEvidence = {
  id: string;
  name: string;
  /** Overall assessment score (%) — deliberately similar across demo students. */
  score: number;
  /** Per-question results from the assessment. */
  items: { skill: SkillId; correct: boolean }[];
  /** A short targeted check on the prerequisite (evaporation). null = not collected. */
  prerequisiteCheck: { skill: SkillId; score: number } | null;
  /** The student's own explanation, in their words (reveals misconceptions). */
  explanation: string;
  /** Result of a worked-example / application task, if attempted. */
  appliedTaskResult: "correct" | "incorrect" | "not_tested";
};

export type LearningNeed =
  | "prerequisite_gap"
  | "conceptual_misunderstanding"
  | "application_difficulty"
  | "insufficient_evidence";

export const NEED_LABELS: Record<LearningNeed, string> = {
  prerequisite_gap: "Prerequisite gap",
  conceptual_misunderstanding: "Conceptual misunderstanding",
  application_difficulty: "Application difficulty",
  insufficient_evidence: "Insufficient evidence",
};

export type InterventionId =
  | "prerequisite_revision"
  | "alternative_explanation"
  | "guided_application"
  | "ask_diagnostic";

export type Intervention = {
  id: InterventionId;
  title: string;
  summary: string;
  steps: string[];
  nextActivity: string;
  masteryCheck: string;
};

export const INTERVENTIONS: Record<InterventionId, Intervention> = {
  prerequisite_revision: {
    id: "prerequisite_revision",
    title: "Prerequisite revision — what is evaporation?",
    summary:
      "The evidence points to a missing building block: the student doesn't yet have the idea that heat turns water into invisible vapour.",
    steps: [
      "Show a wet handprint on the board drying in warm air.",
      "Name the idea: heat gives water energy to become invisible water vapour.",
      "Contrast 'gone' vs 'changed into vapour you can't see'.",
    ],
    nextActivity: "evaporation_warm_vs_cool",
    masteryCheck: "Where does the water from a wet towel go when it dries in the sun?",
  },
  alternative_explanation: {
    id: "alternative_explanation",
    title: "A different explanation — how clouds really make rain",
    summary:
      "The student has a specific misconception. Re-teach the mechanism with a fresh model and a worked example, not more of the same.",
    steps: [
      "Surface the belief in their own words, then gently test it.",
      "Model condensation: warm vapour rises, cools, and forms tiny droplets.",
      "Walk a worked example: droplets merge until heavy enough to fall.",
    ],
    nextActivity: "condensation_worked_example",
    masteryCheck: "A cold glass gets water drops on the outside on a hot day. Why?",
  },
  guided_application: {
    id: "guided_application",
    title: "Guided application — use the cycle on a new case",
    summary:
      "The student knows the stages but can't yet apply them. Give a worked example, then a transfer question in a new context.",
    steps: [
      "Work through one real case together (a puddle drying on a sunny day).",
      "Name which stage of the cycle is happening and why.",
      "Hand them a NEW situation to explain on their own.",
    ],
    nextActivity: "apply_dew_on_grass",
    masteryCheck: "Why is the grass wet with dew on a cool morning, even without rain?",
  },
  ask_diagnostic: {
    id: "ask_diagnostic",
    title: "Gather more evidence first",
    summary:
      "There isn't enough evidence to prescribe responsibly. Ask one targeted diagnostic question before choosing an intervention.",
    steps: [
      "Don't assign remediation yet — a single score is not a diagnosis.",
      "Ask one focused question that separates the likely causes.",
      "Re-run the recommendation once the answer is in.",
    ],
    nextActivity: "diagnostic_evaporation_probe",
    masteryCheck: "When a puddle dries up on a sunny day, where does the water go?",
  },
};

export const NEED_TO_INTERVENTION: Record<LearningNeed, InterventionId> = {
  prerequisite_gap: "prerequisite_revision",
  conceptual_misunderstanding: "alternative_explanation",
  application_difficulty: "guided_application",
  insufficient_evidence: "ask_diagnostic",
};

export const SCORE_LEVELS = ["very_weak", "weak", "moderate", "strong", "very_strong"] as const;
export type ScoreLevel = (typeof SCORE_LEVELS)[number];

export type Recommendation = {
  studentId: string;
  studentName: string;
  score: number;
  likelyNeed: LearningNeed;
  needProbabilities: Record<string, number>;
  evidenceStrength: { label: string; score: number; probabilities: Record<string, number> };
  enoughEvidenceProbability: number;
  seriousPrerequisiteGapProbability: number;
  intervention: Intervention;
  needsTeacherReview: boolean;
  reasons: string[];
  jev: { source: "jev" | "demo"; model: string; latencyMs: number };
};

/** Count how much hard evidence we actually have (not just a score). */
export function evidenceSignals(e: StudentEvidence): number {
  let n = 0;
  if (e.items.length >= 2) n++;
  if (e.prerequisiteCheck) n++;
  if (e.explanation.trim().length > 0) n++;
  if (e.appliedTaskResult !== "not_tested") n++;
  return n;
}

// Seed students — cover all five test scenarios.
export const STUDENTS: StudentEvidence[] = [
  {
    id: "aarav",
    name: "Aarav",
    score: 40,
    items: [
      { skill: "evaporation_basics", correct: false },
      { skill: "condensation", correct: false },
      { skill: "precipitation", correct: false },
      { skill: "apply_real_world", correct: false },
    ],
    prerequisiteCheck: { skill: "evaporation_basics", score: 25 },
    explanation: "The water just disappears. I don't really know where it goes.",
    appliedTaskResult: "not_tested",
  },
  {
    id: "meera",
    name: "Meera",
    score: 40,
    items: [
      { skill: "evaporation_basics", correct: true },
      { skill: "condensation", correct: true },
      { skill: "precipitation", correct: true },
      { skill: "apply_real_world", correct: false },
    ],
    prerequisiteCheck: { skill: "evaporation_basics", score: 85 },
    explanation: "Evaporation is water turning into vapour when it's heated. But I can't work out why a puddle dries up.",
    appliedTaskResult: "incorrect",
  },
  {
    id: "rohan",
    name: "Rohan",
    score: 45,
    items: [
      { skill: "evaporation_basics", correct: true },
      { skill: "condensation", correct: false },
      { skill: "precipitation", correct: false },
      { skill: "apply_real_world", correct: false },
    ],
    prerequisiteCheck: { skill: "evaporation_basics", score: 70 },
    explanation: "Clouds fill up with water like a sponge, and when they get too heavy the rain falls out.",
    appliedTaskResult: "not_tested",
  },
  {
    id: "sana",
    name: "Sana",
    score: 40,
    items: [],
    prerequisiteCheck: null,
    explanation: "",
    appliedTaskResult: "not_tested",
  },
  {
    id: "dev",
    name: "Dev",
    score: 42,
    items: [
      { skill: "evaporation_basics", correct: true },
      { skill: "condensation", correct: false },
      { skill: "precipitation", correct: false },
      { skill: "apply_real_world", correct: false },
    ],
    prerequisiteCheck: { skill: "evaporation_basics", score: 85 },
    explanation: "I'm not sure.",
    appliedTaskResult: "not_tested",
  },
  {
    id: "priya",
    name: "Priya",
    score: 92,
    items: [
      { skill: "evaporation_basics", correct: true },
      { skill: "condensation", correct: true },
      { skill: "precipitation", correct: true },
      { skill: "apply_real_world", correct: true },
    ],
    prerequisiteCheck: { skill: "evaporation_basics", score: 95 },
    explanation:
      "A puddle dries because the sun's heat evaporates the water into vapour, which rises, cools and condenses into clouds.",
    appliedTaskResult: "correct",
  },
  {
    id: "kabir",
    name: "Kabir",
    score: 66,
    items: [
      { skill: "evaporation_basics", correct: true },
      { skill: "condensation", correct: true },
      { skill: "precipitation", correct: false },
      { skill: "apply_real_world", correct: false },
    ],
    prerequisiteCheck: { skill: "evaporation_basics", score: 78 },
    explanation: "Water evaporates and makes clouds, but I mix up what happens after the clouds form.",
    appliedTaskResult: "incorrect",
  },
];

export const SCENARIO_NOTES: Record<string, string> = {
  aarav: "Clear prerequisite gap — fails the evaporation check.",
  meera: "Application difficulty — knows the stages, can't apply them.",
  rohan: "Conceptual misunderstanding — the 'sponge' model of clouds.",
  sana: "Missing evidence — only an overall score. Should ask, not guess.",
  dev: "Contradictory — strong prerequisite check but several wrong answers.",
  priya: "Secure across all stages — likely ready to advance.",
  kabir: "Progressing — solid basics, gaps in the later stages.",
};

export function getStudent(id: string): StudentEvidence | undefined {
  return STUDENTS.find((s) => s.id === id);
}

// ----------------------------------------------------------------------------
// Understanding profile — the per-student "propensity vector"
// ----------------------------------------------------------------------------

/** Skills, in the order they appear on the mastery radar. */
export const MASTERY_SKILLS: SkillId[] = [
  "evaporation_basics",
  "condensation",
  "precipitation",
  "apply_real_world",
];

/** Ordered mastery rungs for the Score questions (low -> high). */
export const MASTERY_LEVELS = ["none", "emerging", "developing", "secure"] as const;

export type ProfileFlag = {
  label: string;
  tone: "risk" | "review" | "ready" | "info";
};

export type StudentProfile = {
  studentId: string;
  studentName: string;
  score: number;
  likelyNeed: LearningNeed;
  needProbabilities: Record<string, number>;
  /** Mastery per skill, 0..1. */
  mastery: Record<SkillId, number>;
  readyToAdvance: number;
  atRisk: number;
  /** Targeted misconception / application probabilities (Jev Noul). */
  misconceptionWaterGone: number;
  misconceptionCloudSponge: number;
  canApply: number;
  flags: ProfileFlag[];
  summary: string;
  jev: { source: "jev" | "demo"; model: string; latencyMs: number };
};

export function avgMastery(m: Record<SkillId, number>): number {
  const v = MASTERY_SKILLS.map((s) => m[s] ?? 0);
  return v.reduce((a, b) => a + b, 0) / (v.length || 1);
}

export function weakestSkill(m: Record<SkillId, number>): SkillId {
  return MASTERY_SKILLS.reduce((lo, s) => ((m[s] ?? 0) < (m[lo] ?? 0) ? s : lo), MASTERY_SKILLS[0]);
}

export function strongestSkill(m: Record<SkillId, number>): SkillId {
  return MASTERY_SKILLS.reduce((hi, s) => ((m[s] ?? 0) > (m[hi] ?? 0) ? s : hi), MASTERY_SKILLS[0]);
}

/** A secure student is read from mastery + readiness, not the (4-way) need
 *  Choice — which has no "on track" option, so it falls back to
 *  insufficient_evidence for a student who actually has no problem. */
export function isSecure(m: Record<SkillId, number>, ready: number, atRisk: number): boolean {
  return ready >= 0.6 && avgMastery(m) >= 0.6 && atRisk < 0.5;
}

export function deriveProfileFlags(
  need: LearningNeed,
  m: Record<SkillId, number>,
  ready: number,
  atRisk: number,
): ProfileFlag[] {
  const flags: ProfileFlag[] = [];
  const avg = avgMastery(m);
  if (isSecure(m, ready, atRisk)) {
    flags.push({ label: "Ready to advance", tone: "ready" });
    return flags;
  }
  if (atRisk >= 0.6) flags.push({ label: "At risk", tone: "risk" });
  if (need === "insufficient_evidence") flags.push({ label: "Needs evidence", tone: "review" });
  if (avg < 0.4 && atRisk < 0.6) flags.push({ label: "Low mastery", tone: "risk" });
  if (flags.length === 0) flags.push({ label: "On track", tone: "info" });
  return flags.slice(0, 3);
}

export function buildProfileSummary(
  name: string,
  need: LearningNeed,
  m: Record<SkillId, number>,
  ready: number,
  atRisk: number,
): string {
  const strong = SKILL_LABELS[strongestSkill(m)];
  const weak = SKILL_LABELS[weakestSkill(m)];

  if (isSecure(m, ready, atRisk)) {
    return `${name} is secure across the stages (strongest: ${strong.toLowerCase()}) and looks ready to advance to the next skill. No remediation needed.`;
  }

  const parts: string[] = [`${name}'s strongest area is ${strong.toLowerCase()}; the weakest is ${weak.toLowerCase()}.`];
  if (need === "insufficient_evidence") {
    parts.push("Not enough evidence yet to pinpoint a need — gather one more diagnostic answer before prescribing.");
  } else {
    parts.push(`Likely focus: ${NEED_LABELS[need].toLowerCase()}.`);
  }
  if (atRisk >= 0.6) parts.push("Flagged at risk — prioritise targeted support.");
  return parts.join(" ");
}
