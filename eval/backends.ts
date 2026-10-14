import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildQuestions, demoJev } from "../lib/learnpath";
import { decide, type JevResult } from "../lib/jev";
import type { StudentEvidence } from "../lib/data";
import type { Backend } from "./types";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(HERE, "jev-cache");

export function questionsHash(): string {
  return createHash("sha256").update(JSON.stringify(buildQuestions())).digest("hex").slice(0, 12);
}

export function cachePath(id: string): string {
  return join(CACHE_DIR, `${id}.${questionsHash()}.json`);
}

export class CacheMissError extends Error {
  constructor(id: string, path: string) {
    super(
      `No recorded Jev response for "${id}" at questions hash ${questionsHash()} (expected ${path}). ` +
        `Run \`npm run eval:record\` to (re)record after a question-set change.`,
    );
    this.name = "CacheMissError";
  }
}

export async function getJevResult(backend: Backend, evidence: StudentEvidence): Promise<JevResult> {
  if (backend === "demo") return demoJev(evidence);
  if (backend === "cache") {
    const p = cachePath(evidence.id);
    if (!existsSync(p)) throw new CacheMissError(evidence.id, p);
    return JSON.parse(readFileSync(p, "utf8")) as JevResult;
  }
  return decide(evidence, buildQuestions());
}
