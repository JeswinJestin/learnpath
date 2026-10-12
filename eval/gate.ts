import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { surfaceGuard, noSpecialCasingLint } from "./guards";
import { forbiddenTokens } from "./scenarios/index";
import { runEval } from "./run";
import type { RunReport } from "./types";

export type GateInput = {
  changedFiles: string[];
  addedLines: string[];
  forbidden: string[];
  typecheckOk: boolean;
  trainScore: number;
  trainBase: number;
  holdoutScore: number;
  holdoutBase: number;
};

/** Pure accept-gate decision. No git, no tsc, no fs — fully unit-testable. */
export function gateVerdict(i: GateInput): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const sg = surfaceGuard(i.changedFiles);
  if (!sg.ok) failures.push(`edits outside lib/learnpath.ts: ${sg.offending.join(", ")}`);
  const lint = noSpecialCasingLint(i.addedLines, i.forbidden);
  if (!lint.ok) failures.push(`hard-coded scenario id/name in flow: ${lint.hits.join(", ")}`);
  if (!i.typecheckOk) failures.push("tsc --noEmit reported type errors");
  if (i.trainScore < i.trainBase) failures.push(`train regressed ${i.trainBase} → ${i.trainScore}`);
  if (i.holdoutScore < i.holdoutBase) failures.push(`holdout regressed ${i.holdoutBase} → ${i.holdoutScore}`);
  return { ok: failures.length === 0, failures };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const LATEST = join(HERE, "reports", "latest.json");

function sh(cmd: string): string {
  return execSync(cmd, { encoding: "utf8" });
}

function changedFiles(): string[] {
  return sh("git diff --name-only HEAD").split("\n").map((s) => s.trim()).filter(Boolean);
}

function addedLines(): string[] {
  const diff = sh("git diff HEAD -- lib/learnpath.ts");
  return diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
}

function prevBaseline(split: "train" | "holdout"): number {
  if (!existsSync(LATEST)) return 0;
  try {
    const r = JSON.parse(readFileSync(LATEST, "utf8")) as RunReport;
    return r.split === split ? r.score : 0;
  } catch {
    return 0;
  }
}

async function main() {
  let typecheckOk = true;
  try {
    sh("npm run -s typecheck");
  } catch {
    typecheckOk = false;
  }
  const train = await runEval("demo", "train");
  const holdout = await runEval("demo", "holdout");

  const verdict = gateVerdict({
    changedFiles: changedFiles(),
    addedLines: addedLines(),
    forbidden: forbiddenTokens(),
    typecheckOk,
    trainScore: train.score,
    trainBase: prevBaseline("train"),
    holdoutScore: holdout.score,
    holdoutBase: prevBaseline("holdout"),
  });

  if (!verdict.ok) {
    for (const f of verdict.failures) console.error(`✗ GATE FAIL — ${f}`);
    process.exit(1);
  }
  console.log(`✓ GATE PASS — train ${train.score}% · holdout ${holdout.score}%`);
}

// Only run as a CLI; importing gateVerdict from a test must not trigger this.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
