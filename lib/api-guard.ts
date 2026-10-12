/**
 * Lightweight, dependency-free guards for the public API routes.
 *
 * These harden the routes that proxy a paid Jev key: a best-effort in-memory
 * rate limit, a client key derived from proxy headers, and input bounding so
 * the public endpoint only runs the fixed demo cohort unless custom evidence
 * is explicitly enabled. Pure/easily-testable; no secrets, no I/O.
 *
 * NOTE: the rate limiter is per-instance memory. On serverless (Vercel) each
 * instance has its own map, so this stops casual abuse, not a distributed
 * attack — put a real rate limiter / auth / queue in front for production.
 */
import type { StudentEvidence } from "./data";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Hard cap on distinct rate-limit buckets. The client key derives from the
 * (spoofable) x-forwarded-for header, so an attacker could otherwise mint an
 * unbounded number of buckets and exhaust memory. We prune expired buckets and,
 * when the map is genuinely full of live keys, FAIL SAFE by denying rather than
 * growing without bound.
 */
export const MAX_BUCKETS = 10_000;

function pruneExpired(now: number): void {
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): { ok: boolean; retryAfterMs: number } {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    // A new (or expired) key is the only place the map can grow, so reclaim
    // expired buckets here. If it is still full of LIVE keys, fail safe.
    pruneExpired(now);
    if (buckets.size >= MAX_BUCKETS) {
      return { ok: false, retryAfterMs: windowMs };
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterMs: b.resetAt - now };
  }
  b.count++;
  return { ok: true, retryAfterMs: 0 };
}

/** Test/introspection helper — current number of live buckets. */
export function bucketCount(): number {
  return buckets.size;
}

/** Test helper — clears all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Best-effort client identity from proxy headers (never trusted for auth). */
export function clientKey(req: Request): string {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip")?.trim() || "local";
}

export function allowCustomEvidence(): boolean {
  const v = process.env.ALLOW_CUSTOM_EVIDENCE;
  return v === "1" || v === "true";
}

/**
 * Resolve the evidence to diagnose. By default only KNOWN students are allowed,
 * so the public endpoint can't be fed unbounded attacker payloads to burn the
 * Jev key; arbitrary `evidence` requires ALLOW_CUSTOM_EVIDENCE.
 */
export function resolveEvidence(
  body: { studentId?: string; evidence?: unknown },
  allowCustom: boolean,
  lookup: (id: string) => StudentEvidence | undefined,
): { evidence: StudentEvidence } | { error: string; status: number } {
  if (body.evidence !== undefined) {
    if (!allowCustom) {
      return { error: "Custom evidence is disabled on this server. Use a known studentId.", status: 403 };
    }
    return { evidence: body.evidence as StudentEvidence };
  }
  if (body.studentId) {
    const e = lookup(body.studentId);
    if (!e) return { error: "Unknown studentId.", status: 400 };
    return { evidence: e };
  }
  return { error: "Provide a known studentId (or enable custom evidence).", status: 400 };
}
