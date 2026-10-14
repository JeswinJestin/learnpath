import {
  decideRecommendation,
  demoJev,
  getStudent,
  recommend,
  type StudentEvidence,
} from "@/lib/learnpath";
import { jevConfigured } from "@/lib/jev";
import { allowCustomEvidence, clientKey, rateLimit, resolveEvidence } from "@/lib/api-guard";

type Body = { studentId?: string; evidence?: StudentEvidence };

export async function POST(request: Request) {
  // Best-effort rate limit: this route proxies a paid Jev key.
  const rl = rateLimit(`recommend:${clientKey(request)}`, 30, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Bound the input: known students only, unless custom evidence is enabled.
  const resolved = resolveEvidence(body, allowCustomEvidence(), getStudent);
  if ("error" in resolved) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }
  const evidence = resolved.evidence;

  // No key configured -> run the clearly-labeled demo heuristic.
  if (!jevConfigured()) {
    return Response.json({
      recommendation: decideRecommendation(evidence, demoJev(evidence)),
      notice: "No Jev API key configured — showing DEMO judgments (not real Jev output). Set JEV_API_KEY to go live.",
    });
  }

  // Key configured -> real Jev call. On failure, fall back to demo. The detailed
  // provider error (endpoint + response body) is logged SERVER-SIDE only and is
  // never returned to the client, to avoid leaking internal integration details.
  try {
    const recommendation = await recommend(evidence);
    return Response.json({ recommendation });
  } catch (err) {
    console.error("[api/recommend] Jev call failed:", err instanceof Error ? err.message : err);
    return Response.json(
      {
        recommendation: decideRecommendation(evidence, demoJev(evidence)),
        jevError: "Live Jev call failed; showing demo judgments. See server logs for details.",
        notice: "Live Jev call failed — showing DEMO judgments (not real Jev output).",
      },
      { status: 200 },
    );
  }
}
