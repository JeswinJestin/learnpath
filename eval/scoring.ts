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
