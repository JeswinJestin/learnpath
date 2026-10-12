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
