# Security Notes

LearnPath calls Jev (TypeSafe AI) with a **server-side** API key. This document
records how the key is protected and the known limits of the public API routes.

## Secrets
- The key is read server-side only (`JEV_API_KEY` / `AI_GATEWAY_API_KEY`) in
  `lib/jev.ts` and sent only to the Jev provider as an `Authorization` header.
  It is never shipped to the browser.
- `.env.local` is git-ignored and has never been committed. The repository
  contains only placeholder keys in docs (`apikey_…`, `sk_your_key_here`).

## API route hardening (`app/api/recommend`, `app/api/cohort`)
Both routes proxy the paid key, so they are hardened in `lib/api-guard.ts`:

- **Input bounding.** `/api/recommend` accepts only a **known `studentId`** (the
  fixed demo cohort) by default. Arbitrary attacker-supplied `evidence` is
  rejected (403) unless `ALLOW_CUSTOM_EVIDENCE=1` is set — so a public endpoint
  can't be fed unbounded payloads to run up key usage.
- **Rate limiting.** A best-effort in-memory fixed-window limiter (per client IP
  from proxy headers). This stops casual abuse.
- **No error-detail leakage.** Provider errors (endpoint URL, raw response body)
  are logged **server-side only**; clients receive a generic message.

## Known limitations (for a production deployment)
- The rate limiter is **per-instance memory**. On serverless (e.g. Vercel) each
  instance has its own counter, so it is not a distributed guarantee. Put a real
  rate limiter / authentication / request queue in front before exposing a key
  under load.
- The client key is derived from `x-forwarded-for`, which is **client-settable
  and therefore spoofable** — an attacker can rotate it to dodge the per-IP
  limit. To stop that from also exhausting memory, the bucket map is pruned of
  expired entries and hard-capped (`MAX_BUCKETS`), failing safe (deny) when full.
  Real per-user limiting needs a trusted identity (auth) upstream.
- **Inherent limit (accepted):** because the key is spoofable, an attacker can
  fill the bucket cap with distinct forged IPs and cause legitimate users to be
  denied for one window (a lockout DoS). This cannot be solved in-process by any
  per-IP limiter with a spoofable key; it belongs to an upstream WAF / edge rate
  limiter / authenticated identity. Pruning is throttled to one scan per window
  so the flood itself costs ~O(1) per request rather than O(n²).
- There is no user authentication; the routes are intended for the bundled demo.

## Reporting
This is a personal/educational project. Open an issue for anything you spot.
