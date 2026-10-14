import { writeFileSync } from "node:fs";
import { buildQuestions } from "../lib/learnpath";
import { decide } from "../lib/jev";
import { loadScenarios } from "./scenarios/index";
import { cachePath, questionsHash } from "./backends";

async function main() {
  const scenarios = loadScenarios("all");
  const hash = questionsHash();
  console.log(`Recording ${scenarios.length} scenarios at questions hash ${hash} …`);
  let ok = 0;
  for (const s of scenarios) {
    const jev = await decide(s.evidence, buildQuestions());
    writeFileSync(cachePath(s.id), JSON.stringify(jev, null, 2));
    console.log(`  ✓ ${s.id}  (${jev.latencyMs}ms, model=${jev.model})`);
    ok++;
  }
  console.log(`Recorded ${ok}/${scenarios.length} at hash ${hash}.`);
}

main().catch((e) => {
  console.error(`✗ record failed: ${e?.message || e}`);
  console.error("  (cache recording needs a Jev key — run via `npm run eval:record`.)");
  process.exit(1);
});
