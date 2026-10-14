import { test } from "node:test";
import assert from "node:assert/strict";
import { surfaceGuard, noSpecialCasingLint } from "./guards";

test("surfaceGuard: only lib/learnpath.ts passes", () => {
  assert.deepEqual(surfaceGuard(["lib/learnpath.ts"]), { ok: true, offending: [] });
});

test("surfaceGuard: any other file fails and is reported", () => {
  const r = surfaceGuard(["lib/learnpath.ts", "lib/data.ts"]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.offending, ["lib/data.ts"]);
});

test("noSpecialCasingLint: quoted scenario id in added line is a hit", () => {
  const r = noSpecialCasingLint(['  if (e.id === "aarav") return "prerequisite_gap";'], ["aarav", "meera"]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.hits, ["aarav"]);
});

test("noSpecialCasingLint: case-insensitive name match", () => {
  const r = noSpecialCasingLint(["  if (name === 'Meera') {"], ["aarav", "meera"]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.hits, ["meera"]);
});

test("noSpecialCasingLint: a legitimate threshold change is clean", () => {
  const r = noSpecialCasingLint(["  const PREREQ_FAIL = 45;"], ["aarav", "meera"]);
  assert.deepEqual(r, { ok: true, hits: [] });
});

test("noSpecialCasingLint: forbidden token only as substring (not quoted) is clean", () => {
  const r = noSpecialCasingLint(["  // devise a better rule"], ["dev"]);
  assert.deepEqual(r, { ok: true, hits: [] });
});
