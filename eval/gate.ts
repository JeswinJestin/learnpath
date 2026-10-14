import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { surfaceGuard, noSpecialCasingLint } from "./guards";
import { forbiddenTokens } from "./scenarios/index";
import { runEval, readBaseline } from "./run";
import type { Baseline } from "./types";

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

function sh(cmd: string): string {
  return execSync(cmd, { encoding: "utf8" });
}

/**
 * Parse `git status --porcelain` output into the list of changed paths,
 * INCLUDING untracked (`??`) files — so a flow edit smuggled into a new,
 * never-added file cannot slip past the surface guard. Pure + unit-tested.
 */
export function parseChangedFiles(porcelain: string): string[] {
  const out: string[] = [];
  for (const raw of porcelain.split("\n")) {
    if (!raw.trim()) continue;
    const rest = raw.slice(3); // strip the 2-char status + separating space
    const path = rest.includes(" -> ") ? rest.split(" -> ")[1] : rest; // renames report the new path
    const trimmed = path.trim();
    if (trimmed) out.push(trimmed);
  }
  return out;
}

/**
 * Generated eval outputs are expected to change on every run, so they are not
 * "the flow" and must not trip the surface guard.
 */
export function isSurfaceRelevant(path: string): boolean {
  return !path.startsWith("eval/reports/");
}

function changedFiles(): string[] {
  return parseChangedFiles(sh("git status --porcelain")).filter(isSurfaceRelevant);
}

function addedLines(): string[] {
  const diff = sh("git diff HEAD -- lib/learnpath.ts");
  return diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
}

/**
 * Resolve the pre-change baseline into gate inputs. A MISSING baseline refuses
 * (ok:false): a gate run without a recorded two-split baseline cannot guard a
 * regression and must not silently pass. Pure + unit-tested.
 */
export function baselineInputs(
  b: Baseline | null,
): { ok: boolean; trainBase: number; holdoutBase: number; error?: string } {
  if (!b) {
    return {
      ok: false,
      trainBase: 0,
      holdoutBase: 0,
      error: "no baseline recorded; run `npm run eval:baseline` before the flow edit",
    };
  }
  return { ok: true, trainBase: b.train, holdoutBase: b.holdout };
}

async function main() {
  const base = baselineInputs(readBaseline());
  if (!base.ok) {
    console.error(`✗ GATE FAIL — ${base.error}`);
    process.exit(1);
  }

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
    trainBase: base.trainBase,
    holdoutScore: holdout.score,
    holdoutBase: base.holdoutBase,
  });

  if (!verdict.ok) {
    for (const f of verdict.failures) console.error(`✗ GATE FAIL — ${f}`);
    process.exit(1);
  }
  console.log(
    `✓ GATE PASS — train ${train.score}% (base ${base.trainBase}) · holdout ${holdout.score}% (base ${base.holdoutBase})`,
  );
}

// Only run as a CLI; importing gateVerdict from a test must not trigger this.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
