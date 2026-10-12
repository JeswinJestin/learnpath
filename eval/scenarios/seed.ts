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
    rationale:
      "KNOWN FLOW LIMITATION: Priya is secure across all stages, but the 4-way need Choice has no 'on track' option, so the recommend flow routes her to insufficient_evidence. Labeled to CURRENT behavior and tracked as a limitation (see spec §5.6), not a tuning target for the build agent.",
  },
  {
    id: "kabir",
    evidence: ev("kabir"),
    expected: { likelyNeed: "application_difficulty", interventionId: "guided_application", needsTeacherReview: false },
    rationale: "Solid basics (evaporation + condensation correct, prereq 78%) but fails precipitation and the applied task — cannot yet apply the later stages.",
  },
];
