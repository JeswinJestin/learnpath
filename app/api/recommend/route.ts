import {
  decideRecommendation,
  demoJev,
  getStudent,
  recommend,
  type StudentEvidence,
} from "@/lib/learnpath";
import { jevConfigured, JevNotConfiguredError, JevRequestError } from "@/lib/jev";

type Body = { studentId?: string; evidence?: StudentEvidence };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const evidence = body.evidence ?? (body.studentId ? getStudent(body.studentId) : undefined);
  if (!evidence) {
    return Response.json({ error: "Provide a known studentId or an evidence object." }, { status: 400 });
  }

  // No key configured -> run the clearly-labeled demo heuristic.
  if (!jevConfigured()) {
    return Response.json({
      recommendation: decideRecommendation(evidence, demoJev(evidence)),
      notice: "No Jev API key configured — showing DEMO judgments (not real Jev output). Set JEV_API_KEY to go live.",
    });
  }

  // Key configured -> real Jev call. On failure, fall back to demo but surface
  // the error so the integration can be fixed (never fake a real response).
  try {
    const recommendation = await recommend(evidence);
    return Response.json({ recommendation });
  } catch (err) {
    const message =
      err instanceof JevRequestError
        ? err.message
        : err instanceof JevNotConfiguredError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown error calling Jev.";

    return Response.json(
      {
        recommendation: decideRecommendation(evidence, demoJev(evidence)),
        jevError: message,
        notice: "Live Jev call failed — showing DEMO judgments (not real Jev output). See jevError.",
      },
      { status: 200 },
    );
  }
}
