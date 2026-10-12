import { pathToFileURL } from "node:url";
import { runEval, buildBaseline, writeBaseline, formatReport } from "./run";
import type { Backend } from "./types";

/**
 * Record the pre-change baseline for BOTH splits into eval/reports/baseline.json,
 * so one `eval:gate` run can guard train AND holdout no-regression. Run this
 * immediately before the build agent edits the flow.
 */
async function main() {
  const i = process.argv.indexOf("--backend");
  const backend = (i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : "demo") as Backend;

  const train = await runEval(backend, "train");
  const holdout = await runEval(backend, "holdout");
  const baseline = buildBaseline(backend, train, holdout);
  writeBaseline(baseline);

  process.stdout.write(formatReport(train));
  process.stdout.write(formatReport(holdout));
  console.log(
    `\nBaseline recorded (backend ${backend}): train ${baseline.train}% · holdout ${baseline.holdout}% → eval/reports/baseline.json\n`,
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
