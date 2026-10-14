import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { decideRecommendation } from "../lib/learnpath";
import { loadScenarios } from "./scenarios/index";
import { getJevResult } from "./backends";
import { aggregate, confusionMatrix, regressionsVs, scoreCase } from "./scoring";
import type { Backend, Baseline, CaseResult, RunReport, Split } from "./types";

const HERE = dirname(fileURLToPath(import.meta.url));
const LATEST = join(HERE, "reports", "latest.json");
const SCOREBOARD = join(HERE, "reports", "scoreboard.md");
const BASELINE = join(HERE, "reports", "baseline.json");

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

/** Build a two-split baseline from a train run and a holdout run (pure). */
export function buildBaseline(backend: Backend, train: RunReport, holdout: RunReport): Baseline {
  return { backend, train: train.score, holdout: holdout.score, timestamp: new Date().toISOString() };
}

export function writeBaseline(b: Baseline): void {
  writeFileSync(BASELINE, JSON.stringify(b, null, 2));
}

export function readBaseline(): Baseline | null {
  if (!existsSync(BASELINE)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE, "utf8")) as Baseline;
  } catch {
    return null;
  }
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
