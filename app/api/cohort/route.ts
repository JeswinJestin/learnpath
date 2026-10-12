import { STUDENTS, computeProfile, demoProfileJev, profileFor, type StudentProfile } from "@/lib/learnpath";
import { jevConfigured } from "@/lib/jev";

export async function GET() {
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
  let jevError: string | null = null;
  const profiles: StudentProfile[] = await Promise.all(
    STUDENTS.map(async (e) => {
      try {
        return await profileFor(e);
      } catch (err) {
        jevError = err instanceof Error ? err.message : "Unknown error calling Jev.";
        return computeProfile(e, demoProfileJev(e));
      }
    }),
  );

  return Response.json({
    profiles,
    ...(jevError
      ? { jevError, notice: "Some live Jev calls failed — those rows show DEMO profiles. See jevError." }
      : {}),
  });
}
