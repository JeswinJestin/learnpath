import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, resetRateLimits, clientKey, resolveEvidence } from "./api-guard";
import type { StudentEvidence } from "./data";

const fakeEvidence = (id: string): StudentEvidence => ({
  id,
  name: id,
  score: 50,
  items: [],
  prerequisiteCheck: null,
  explanation: "",
  appliedTaskResult: "not_tested",
});

test("rateLimit: allows up to the limit, then blocks within the window", () => {
  resetRateLimits();
  const t0 = 1_000_000;
  assert.equal(rateLimit("ip", 2, 1000, t0).ok, true);
  assert.equal(rateLimit("ip", 2, 1000, t0).ok, true);
  const blocked = rateLimit("ip", 2, 1000, t0);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterMs > 0);
});

test("rateLimit: window reset allows again", () => {
  resetRateLimits();
  const t0 = 1_000_000;
  rateLimit("ip", 1, 1000, t0);
  assert.equal(rateLimit("ip", 1, 1000, t0).ok, false);
  assert.equal(rateLimit("ip", 1, 1000, t0 + 1001).ok, true);
});

test("rateLimit: separate keys have independent buckets", () => {
  resetRateLimits();
  const t0 = 1_000_000;
  rateLimit("a", 1, 1000, t0);
  assert.equal(rateLimit("a", 1, 1000, t0).ok, false);
  assert.equal(rateLimit("b", 1, 1000, t0).ok, true);
});

test("clientKey: takes the first x-forwarded-for IP", () => {
  const req = new Request("https://x/api", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
  assert.equal(clientKey(req), "1.2.3.4");
});

test("clientKey: falls back to a stable default when no IP header", () => {
  const req = new Request("https://x/api");
  assert.equal(clientKey(req), "local");
});

test("resolveEvidence: custom evidence is rejected (403) unless explicitly allowed", () => {
  const r = resolveEvidence({ evidence: fakeEvidence("x") }, false, () => undefined);
  assert.ok("error" in r && r.status === 403);
});

test("resolveEvidence: custom evidence allowed when the flag is on", () => {
  const r = resolveEvidence({ evidence: fakeEvidence("x") }, true, () => undefined);
  assert.ok("evidence" in r && r.evidence.id === "x");
});

test("resolveEvidence: known studentId resolves via lookup", () => {
  const r = resolveEvidence({ studentId: "aarav" }, false, (id) => (id === "aarav" ? fakeEvidence("aarav") : undefined));
  assert.ok("evidence" in r && r.evidence.id === "aarav");
});

test("resolveEvidence: unknown studentId is a 400", () => {
  const r = resolveEvidence({ studentId: "nobody" }, false, () => undefined);
  assert.ok("error" in r && r.status === 400);
});

test("resolveEvidence: neither studentId nor evidence is a 400", () => {
  const r = resolveEvidence({}, false, () => undefined);
  assert.ok("error" in r && r.status === 400);
});
