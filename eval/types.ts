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

/** Pre-change baseline captured for BOTH splits, so one gate run can guard each. */
export type Baseline = {
  backend: Backend;
  train: number; // 0..100
  holdout: number; // 0..100
  timestamp: string;
};
