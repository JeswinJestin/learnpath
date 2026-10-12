/**
 * Provider-agnostic client for Jev, TypeSafe AI's structured-decision model.
 *
 * Jev is a "System 1" decision model: you give it a `state` (context) and a set
 * of typed `questions`, and it returns structured answers with probabilities —
 * not free-form prose. We ask several bounded questions over one shared state in
 * a single round trip. Our own code (see lib/learnpath.ts) makes the final call;
 * Jev's judgments only inform it.
 *
 * The HTTP contract matches the Vercel AI Gateway decision endpoint:
 *   POST https://ai-gateway.vercel.sh/v1/evaluate
 *   { model, state, questions: { <id>: { type, instructions, criteria? } } }
 * OpenRouter / AIMLAPI / TypeSafe-direct are selectable via env; they accept a
 * near-identical body (boolean questions are called `noul` there).
 *
 * The API key is read server-side only and never shipped to the browser.
 */

export type JevKind = "boolean" | "choice" | "score";

/** A provider-neutral question. `id` becomes the key in the answers map. */
export type JevQuestion =
  | { id: string; kind: "boolean"; instructions: string; criteria?: { true: string; false: string } }
  | { id: string; kind: "choice"; instructions: string; options: Record<string, string> }
  | { id: string; kind: "score"; instructions: string; levels: string[] };

/** Normalized answers — one uniform shape regardless of provider. */
export type JevAnswer =
  | { kind: "boolean"; probability: number }
  | { kind: "choice"; choice: string; probabilities: Record<string, number>; confidence?: number }
  | { kind: "score"; score: number; levels: string[]; probabilities: Record<string, number>; confidence?: number };

export type JevResult = {
  /** "jev" = real model call. "demo" = clearly-labeled synthetic fallback (NOT a real Jev response). */
  source: "jev" | "demo";
  model: string;
  latencyMs: number;
  answers: Record<string, JevAnswer>;
  /** Raw provider payload, for inspection/debugging. */
  raw?: unknown;
};

type ProviderId = "vercel" | "openrouter" | "aimlapi" | "typesafe";

const PROVIDERS: Record<ProviderId, { url: string; model: string; boolType: "boolean" | "noul" }> = {
  vercel: { url: "https://ai-gateway.vercel.sh/v1/evaluate", model: "typesafe-ai/jev", boolType: "boolean" },
  openrouter: { url: "https://openrouter.ai/api/alpha/decisions", model: "typesafe/jev-1.13", boolType: "noul" },
  aimlapi: { url: "https://api.aimlapi.com/v1/decisions", model: "typesafe/jev", boolType: "noul" },
  typesafe: { url: "https://api.typesafe.ai/v1/systemone", model: "jev-latest", boolType: "noul" },
};

function getConfig() {
  const provider = (process.env.JEV_PROVIDER as ProviderId) || "vercel";
  const base = PROVIDERS[provider] ?? PROVIDERS.vercel;
  const apiKey = process.env.JEV_API_KEY || process.env.AI_GATEWAY_API_KEY || "";
  return {
    provider,
    url: process.env.JEV_BASE_URL || base.url,
    model: process.env.JEV_MODEL || base.model,
    boolType: base.boolType,
    apiKey,
  };
}

export function jevConfigured(): boolean {
  return Boolean(process.env.JEV_API_KEY || process.env.AI_GATEWAY_API_KEY);
}

/** Serialize provider-neutral questions into the request body shape. */
function buildQuestions(questions: JevQuestion[], boolType: "boolean" | "noul") {
  const out: Record<string, Record<string, unknown>> = {};
  for (const q of questions) {
    if (q.kind === "boolean") {
      out[q.id] = { type: boolType, instructions: q.instructions, ...(q.criteria ? { criteria: q.criteria } : {}) };
    } else if (q.kind === "choice") {
      // Vercel uses `criteria` as the option map; others accept `options`. Send both for portability.
      out[q.id] = { type: "choice", instructions: q.instructions, criteria: q.options, options: q.options };
    } else {
      out[q.id] = { type: "score", instructions: q.instructions, criteria: q.levels, levels: q.levels };
    }
  }
  return out;
}

/** Coerce any provider's answer object into our uniform JevAnswer. */
function normalizeAnswer(q: JevQuestion, a: unknown): JevAnswer {
  const o = (a ?? {}) as Record<string, unknown>;
  if (q.kind === "choice") {
    const choice = (o.choice ?? o.selected ?? o.value ?? "") as string;
    const probabilities = (o.probabilities ?? o.probs ?? {}) as Record<string, number>;
    return { kind: "choice", choice, probabilities, confidence: num(o.confidence) };
  }
  if (q.kind === "score") {
    return {
      kind: "score",
      score: num(o.score) ?? 0,
      levels: q.levels,
      probabilities: (o.probabilities ?? o.probs ?? {}) as Record<string, number>,
      confidence: num(o.confidence),
    };
  }
  // boolean / noul: probability that the condition holds.
  // TypeSafe returns { type: "noul", noul: 0.79 }; gateways use `probability`.
  const p = num(o.noul) ?? num(o.probability) ?? num(o.p) ?? num(o.yes) ?? 0;
  return { kind: "boolean", probability: p };
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/**
 * Ask Jev a batch of typed questions about one shared state.
 * Throws if no key is configured (callers may fall back to demo mode explicitly).
 */
export async function decide(
  state: unknown,
  questions: JevQuestion[],
  opts: { signal?: AbortSignal } = {},
): Promise<JevResult> {
  const cfg = getConfig();
  if (!cfg.apiKey) {
    throw new JevNotConfiguredError();
  }

  const body = { model: cfg.model, state, questions: buildQuestions(questions, cfg.boolType) };
  const started = Date.now();

  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  const latencyMs = Date.now() - started;

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new JevRequestError(res.status, text, cfg.url);
  }

  const payload = (await res.json()) as Record<string, unknown>;
  const answersRaw = (payload.answers ?? payload) as Record<string, unknown>;

  const answers: Record<string, JevAnswer> = {};
  for (const q of questions) {
    answers[q.id] = normalizeAnswer(q, answersRaw[q.id]);
  }

  return {
    source: "jev",
    model: (payload.model as string) || cfg.model,
    latencyMs,
    answers,
    raw: payload,
  };
}

export class JevNotConfiguredError extends Error {
  constructor() {
    super("Jev API key not configured (set JEV_API_KEY or AI_GATEWAY_API_KEY).");
    this.name = "JevNotConfiguredError";
  }
}

export class JevRequestError extends Error {
  constructor(
    public status: number,
    public body: string,
    public url: string,
  ) {
    super(`Jev request failed (${status}) at ${url}: ${body.slice(0, 300)}`);
    this.name = "JevRequestError";
  }
}
