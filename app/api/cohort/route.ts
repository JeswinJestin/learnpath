import { STUDENTS, computeProfile, demoProfileJev, profileFor, type StudentProfile } from "@/lib/learnpath";
import { jevConfigured } from "@/lib/jev";
import { clientKey, rateLimit } from "@/lib/api-guard";

export async function GET(request: Request) {
  // Best-effort rate limit: this route fans out one paid Jev call per student.
  const rl = rateLimit(`cohort:${clientKey(request)}`, 15, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // No key -> clearly-labeled demo profiles for the whole cohort.
  if (!jevConfigured()) {
    const profiles = STUDENTS.map((e) => computeProfile(e, demoProfileJev(e)));
    return Response.json({
      profiles,
      notice: "No Jev API key configured — showing DEMO profiles (not real Jev output). Set JEV_API_KEY to go live.",
    });
  }

  // Real Jev: compute every student's profile in parallel. Any individual
  // failure falls back to a labeled demo profile so the dashboard still loads.
  // Provider error detail is logged server-side only, never returned to clients.
  let jevFailed = false;
  const profiles: StudentProfile[] = await Promise.all(
    STUDENTS.map(async (e) => {
      try {
        return await profileFor(e);
      } catch (err) {
        jevFailed = true;
        console.error(`[api/cohort] Jev call failed for ${e.id}:`, err instanceof Error ? err.message : err);
        return computeProfile(e, demoProfileJev(e));
      }
    }),
  );

  return Response.json({
    profiles,
    ...(jevFailed
      ? { jevError: "Some live Jev calls failed; those rows show demo profiles. See server logs for details." }
      : {}),
  });
}
