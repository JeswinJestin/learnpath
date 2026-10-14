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
