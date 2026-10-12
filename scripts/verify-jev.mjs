/**
 * Verify a real Jev call. Run after putting your key in .env.local:
 *
 *   node --env-file=.env.local scripts/verify-jev.mjs
 *
 * Prints the endpoint, HTTP status, latency, and the raw response so we can
 * confirm authentication and the answer format before trusting the app.
 */

const PROVIDERS = {
  vercel: { url: "https://ai-gateway.vercel.sh/v1/evaluate", model: "typesafe-ai/jev", boolType: "boolean" },
  openrouter: { url: "https://openrouter.ai/api/alpha/decisions", model: "typesafe/jev-1.13", boolType: "noul" },
  aimlapi: { url: "https://api.aimlapi.com/v1/decisions", model: "typesafe/jev", boolType: "noul" },
  typesafe: { url: "https://api.typesafe.ai/v1/systemone", model: "jev-latest", boolType: "noul" },
};

const provider = process.env.JEV_PROVIDER || "vercel";
const base = PROVIDERS[provider] || PROVIDERS.vercel;
const url = process.env.JEV_BASE_URL || base.url;
const model = process.env.JEV_MODEL || base.model;
const apiKey = process.env.JEV_API_KEY || process.env.AI_GATEWAY_API_KEY;

if (!apiKey) {
  console.error("✗ No key found. Put JEV_API_KEY=... in .env.local and run with --env-file=.env.local");
  process.exit(1);
}

const body = {
  model,
  state: "A student wrote: 'The water just disappears, I don't know where it goes.' They failed the evaporation check.",
  questions: {
    likely_need: {
      type: "choice",
      instructions: "Which learning need best explains this?",
      criteria: {
        prerequisite_gap: "Missing the idea that heat turns water into invisible vapour.",
        application_difficulty: "Knows the stages but can't apply them.",
      },
      options: {
        prerequisite_gap: "Missing the idea that heat turns water into invisible vapour.",
        application_difficulty: "Knows the stages but can't apply them.",
      },
    },
    enough_evidence: {
      type: base.boolType,
      instructions: "Is there enough evidence to recommend an intervention?",
    },
  },
};

console.log(`→ POST ${url}  (provider=${provider}, model=${model})`);

const started = Date.now();
try {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const ms = Date.now() - started;
  const text = await res.text();
  console.log(`← ${res.status} ${res.statusText}  (${ms} ms)`);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
  if (!res.ok) {
    console.error("\n✗ Non-200. If this is an auth error, check the key and JEV_PROVIDER.");
    process.exit(1);
  }
  console.log("\n✓ Real Jev call succeeded.");
} catch (err) {
  console.error("✗ Request threw:", err?.message || err);
  process.exit(1);
}
