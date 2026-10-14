import { test } from "node:test";
import assert from "node:assert/strict";
import { questionsHash, getJevResult, CacheMissError } from "./backends";
import { getStudent } from "../lib/data";

test("questionsHash is a stable 12-hex string", () => {
  const h = questionsHash();
  assert.match(h, /^[0-9a-f]{12}$/);
  assert.equal(h, questionsHash());
});

test("demo backend returns a demo-sourced JevResult with the recommend answers", async () => {
  const r = await getJevResult("demo", getStudent("aarav")!);
  assert.equal(r.source, "demo");
  assert.ok(r.answers.likely_need);
  assert.ok(r.answers.enough_evidence);
});

test("cache backend throws CacheMissError when no file recorded", async () => {
  await assert.rejects(
    () => getJevResult("cache", getStudent("sana")!),
    (e: unknown) => e instanceof CacheMissError && /eval:record/.test((e as Error).message),
  );
});
