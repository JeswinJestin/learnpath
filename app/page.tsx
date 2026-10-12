"use client";

import { useState } from "react";
import {
  INTERVENTIONS,
  NEED_LABELS,
  SCENARIO_NOTES,
  SCORE_LEVELS,
  SKILL_LABELS,
  STUDENTS,
  type InterventionId,
  type LearningNeed,
  type Recommendation,
  type StudentEvidence,
} from "@/lib/data";
import CohortView from "./cohort-view";

type View = "diagnostic" | "cohort";

const NEED_ORDER: LearningNeed[] = [
  "prerequisite_gap",
  "conceptual_misunderstanding",
  "application_difficulty",
  "insufficient_evidence",
];

// Shared frosted-card surface.
const CARD =
  "rounded-3xl border border-white/70 bg-white/70 shadow-[0_2px_16px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:ring-white/5";

function pct(p: number) {
  return `${Math.round((p ?? 0) * 100)}%`;
}

export default function Home() {
  const [view, setView] = useState<View>("diagnostic");
  const [selectedId, setSelectedId] = useState<string>(STUDENTS[0].id);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [jevError, setJevError] = useState<string | null>(null);
  const [overrideId, setOverrideId] = useState<InterventionId | "">("");
  const [followup, setFollowup] = useState<"none" | "pass" | "fail">("none");

  const student = STUDENTS.find((s) => s.id === selectedId)!;

  function select(id: string) {
    setSelectedId(id);
    setResult(null);
    setNotice(null);
    setJevError(null);
    setOverrideId("");
    setFollowup("none");
  }

  async function runRecommend() {
    setLoading(true);
    setNotice(null);
    setJevError(null);
    setOverrideId("");
    setFollowup("none");
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJevError(data?.error ?? "Request failed.");
        setResult(null);
      } else {
        setResult(data.recommendation as Recommendation);
        setNotice(data.notice ?? null);
        setJevError(data.jevError ?? null);
      }
    } catch (e) {
      setJevError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  const effectiveIntervention = result
    ? overrideId
      ? INTERVENTIONS[overrideId]
      : result.intervention
    : null;

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 text-slate-900 dark:from-zinc-950 dark:via-zinc-950 dark:to-black dark:text-zinc-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
        {/* Header */}
        <header className="mb-7">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white shadow-md shadow-slate-900/20 dark:bg-white dark:text-slate-900">
              L
            </div>
            <div>
              <h1 className="text-[1.65rem] font-semibold tracking-tight">LearnPath</h1>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Water Cycle · Grade 5 diagnostic · powered by Jev decision model
              </p>
            </div>
          </div>
          <p className={`mt-5 max-w-3xl p-5 text-[15px] leading-relaxed text-slate-600 dark:text-zinc-300 ${CARD}`}>
            A low score tells us a student is <span className="font-semibold text-slate-900 dark:text-zinc-100">struggling</span>.
            It doesn&apos;t tell us <span className="font-semibold text-slate-900 dark:text-zinc-100">what help they need</span>.
            LearnPath gathers targeted evidence, uses Jev to interpret it, and lets explicit code choose the next step — so
            the same 40% can lead to different, inspectable decisions.
          </p>
        </header>

        {/* View tabs */}
        <div className="mb-6 inline-flex rounded-2xl border border-white/70 bg-white/60 p-1 shadow-sm ring-1 ring-slate-900/[0.03] dark:border-white/10 dark:bg-white/[0.04] dark:ring-white/5">
          {(
            [
              ["diagnostic", "Diagnostic"],
              ["cohort", "Teacher cohort"],
            ] as [View, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`rounded-xl px-4 py-1.5 text-sm font-medium transition ${
                view === id
                  ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                  : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "cohort" ? (
          <CohortView />
        ) : (
          <>
        {/* Student rail */}
        <section className="mb-6">
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500">
            Same assessment · pick a student
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {STUDENTS.map((s) => {
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  onClick={() => select(s.id)}
                  className={`rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                    active
                      ? "border-slate-900/15 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/20 dark:border-white/20 dark:bg-white/10 dark:ring-white/20"
                      : "border-white/70 bg-white/60 shadow-sm ring-1 ring-slate-900/[0.03] hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:ring-white/5 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{s.name}</span>
                    <span
                      className={`inline-flex min-w-[3rem] justify-center rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums ${
                        active
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-200"
                      }`}
                    >
                      {s.score}%
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-snug text-slate-500 dark:text-zinc-400">
                    {SCENARIO_NOTES[s.id]}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Evidence */}
          <section className={`p-6 ${CARD}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Evidence · {student.name}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-zinc-300">
                score {student.score}%
              </span>
            </div>

            <EvidenceView student={student} />

            <button
              onClick={runRecommend}
              disabled={loading}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-slate-900/20 transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:shadow-black/40 dark:hover:bg-zinc-200"
            >
              {loading ? "Asking Jev…" : "Recommend next step"}
            </button>
          </section>

          {/* Result */}
          <section className={`p-6 ${CARD}`}>
            <h2 className="text-lg font-semibold tracking-tight">Recommendation</h2>

            {!result && !jevError && (
              <p className="mt-6 text-sm text-slate-500 dark:text-zinc-400">
                Select a student and press <span className="font-medium text-slate-700 dark:text-zinc-200">Recommend next step</span>.
                You&apos;ll see Jev&apos;s structured judgments and the decision LearnPath makes from them.
              </p>
            )}

            {jevError && !result && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {jevError}
              </p>
            )}

            {result && (
              <div className="mt-4 space-y-5">
                {/* source + notices */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <SourceBadge source={result.jev.source} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 dark:bg-white/10 dark:text-zinc-300">
                    {result.jev.model}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium tabular-nums text-slate-600 dark:bg-white/10 dark:text-zinc-300">
                    {result.jev.latencyMs} ms
                  </span>
                </div>
                {notice && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    {notice}
                    {jevError ? <span className="mt-1 block font-mono opacity-80">{jevError}</span> : null}
                  </p>
                )}

                {/* What Jev judged */}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500">
                    What Jev judged (structured, not prose)
                  </h3>
                  <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/5 dark:bg-black/20">
                    {/* choice */}
                    <div>
                      <div className="mb-2 text-xs font-medium text-slate-500 dark:text-zinc-400">
                        Likely learning need <span className="opacity-60">(Choice)</span>
                      </div>
                      <div className="space-y-1.5">
                        {NEED_ORDER.map((n) => (
                          <ProbRow
                            key={n}
                            label={NEED_LABELS[n]}
                            prob={result.needProbabilities[n] ?? 0}
                            highlight={result.likelyNeed === n}
                          />
                        ))}
                      </div>
                    </div>
                    {/* score */}
                    <div>
                      <div className="mb-2 text-xs font-medium text-slate-500 dark:text-zinc-400">
                        Evidence strength <span className="opacity-60">(Score)</span> ·{" "}
                        <span className="font-semibold text-slate-700 dark:text-zinc-200">
                          {result.evidenceStrength.label.replace("_", " ")}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {SCORE_LEVELS.map((lvl, i) => (
                          <ProbRow
                            key={lvl}
                            label={lvl.replace("_", " ")}
                            prob={result.evidenceStrength.probabilities[String(i)] ?? 0}
                            highlight={Math.round(result.evidenceStrength.score) === i}
                          />
                        ))}
                      </div>
                    </div>
                    {/* booleans */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <BoolMeter label="Enough evidence to prescribe?" prob={result.enoughEvidenceProbability} />
                      <BoolMeter label="Serious prerequisite gap?" prob={result.seriousPrerequisiteGapProbability} />
                    </div>
                  </div>
                </div>

                {/* Decision */}
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-zinc-500">
                    LearnPath&apos;s decision (deterministic code)
                  </h3>

                  {result.needsTeacherReview && (
                    <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      ⚠ Flagged for teacher review — the evidence is weak or conflicting.
                    </p>
                  )}

                  <div className="rounded-2xl border border-slate-900/10 bg-slate-900/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.04]">
                    <h4 className="font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
                      {effectiveIntervention!.title}
                      {overrideId && <span className="ml-2 text-xs font-normal opacity-60">(teacher override)</span>}
                    </h4>
                    <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">{effectiveIntervention!.summary}</p>
                    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
                      {effectiveIntervention!.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                    <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                      <div className="rounded-xl bg-white/70 p-2.5 ring-1 ring-slate-900/5 dark:bg-white/5 dark:ring-white/5">
                        <span className="block font-medium text-slate-400 dark:text-zinc-500">Next activity</span>
                        <span className="font-mono text-slate-700 dark:text-zinc-200">{effectiveIntervention!.nextActivity}</span>
                      </div>
                      <div className="rounded-xl bg-white/70 p-2.5 ring-1 ring-slate-900/5 dark:bg-white/5 dark:ring-white/5">
                        <span className="block font-medium text-slate-400 dark:text-zinc-500">Mastery check</span>
                        <span className="text-slate-700 dark:text-zinc-200">{effectiveIntervention!.masteryCheck}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reason codes */}
                  <div className="mt-3">
                    <div className="mb-1.5 text-xs font-medium text-slate-400 dark:text-zinc-500">Why (reason codes)</div>
                    <ul className="space-y-1 text-sm text-slate-700 dark:text-zinc-300">
                      {result.reasons.map((r, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-slate-400 dark:bg-zinc-500" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Teacher override */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <label className="text-xs font-medium text-slate-400 dark:text-zinc-500">Teacher override:</label>
                    <select
                      value={overrideId}
                      onChange={(e) => setOverrideId(e.target.value as InterventionId | "")}
                      className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                    >
                      <option value="">Accept recommendation</option>
                      {Object.values(INTERVENTIONS).map((iv) => (
                        <option key={iv.id} value={iv.id}>
                          {iv.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Follow-up loop */}
                  {effectiveIntervention!.id !== "ask_diagnostic" && (
                    <div className="mt-4 rounded-2xl border border-slate-200/70 p-3.5 dark:border-white/10">
                      <div className="text-sm font-medium">Follow-up: did the student pass the mastery check?</div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => setFollowup("pass")}
                          className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                            followup === "pass"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-200"
                          }`}
                        >
                          Passed
                        </button>
                        <button
                          onClick={() => setFollowup("fail")}
                          className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                            followup === "fail"
                              ? "bg-rose-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-200"
                          }`}
                        >
                          Needs another try
                        </button>
                      </div>
                      {followup === "pass" && (
                        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
                          ✓ Mastery shown — progress to the next challenge (condensation → precipitation).
                        </p>
                      )}
                      {followup === "fail" && (
                        <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">
                          ↻ Re-run with new evidence — the chosen intervention didn&apos;t land; try a different
                          explanation or collect another diagnostic answer.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
          </>
        )}

        <footer className="mt-8 text-center text-xs text-slate-400 dark:text-zinc-600">
          Jev returns structured probabilities (System 1). LearnPath&apos;s own code applies thresholds and
          human-review rules to make the final decision.
        </footer>
      </div>
    </div>
  );
}

function EvidenceView({ student }: { student: StudentEvidence }) {
  return (
    <div className="mt-5 space-y-4">
      {/* item results */}
      <div>
        <div className="mb-2 text-xs font-medium text-slate-500 dark:text-zinc-400">Question-level results</div>
        {student.items.length === 0 ? (
          <p className="text-sm italic text-slate-400 dark:text-zinc-500">
            No item-level data collected — only an overall score.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {student.items.map((it, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  it.correct
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                }`}
              >
                {it.correct ? "✓" : "✗"} {SKILL_LABELS[it.skill]}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* prerequisite check */}
      <div>
        <div className="mb-2 text-xs font-medium text-slate-500 dark:text-zinc-400">Prerequisite check (evaporation)</div>
        {student.prerequisiteCheck ? (
          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${
                  student.prerequisiteCheck.score < 40
                    ? "bg-rose-500"
                    : student.prerequisiteCheck.score < 70
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${student.prerequisiteCheck.score}%` }}
              />
            </div>
            <span className="w-10 text-right text-sm font-semibold tabular-nums">{student.prerequisiteCheck.score}%</span>
          </div>
        ) : (
          <p className="text-sm italic text-slate-400 dark:text-zinc-500">Not collected.</p>
        )}
      </div>

      {/* explanation */}
      <div>
        <div className="mb-2 text-xs font-medium text-slate-500 dark:text-zinc-400">Student&apos;s explanation</div>
        {student.explanation ? (
          <blockquote className="rounded-r-lg border-l-2 border-slate-300 bg-slate-50/60 py-1.5 pl-3 text-sm italic text-slate-600 dark:border-white/15 dark:bg-white/5 dark:text-zinc-300">
            &ldquo;{student.explanation}&rdquo;
          </blockquote>
        ) : (
          <p className="text-sm italic text-slate-400 dark:text-zinc-500">None provided.</p>
        )}
      </div>

      {/* applied task */}
      <div className="text-xs text-slate-500 dark:text-zinc-400">
        Application task:{" "}
        <span className="font-medium text-slate-700 dark:text-zinc-200">
          {student.appliedTaskResult.replace("_", " ")}
        </span>
      </div>
    </div>
  );
}

function ProbRow({ label, prob, highlight }: { label: string; prob: number; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-32 flex-none truncate text-xs ${highlight ? "font-semibold text-slate-800 dark:text-zinc-100" : "text-slate-500 dark:text-zinc-400"}`}>
        {label}
      </div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${highlight ? "bg-slate-900 dark:bg-white" : "bg-slate-300 dark:bg-white/25"}`}
          style={{ width: pct(prob) }}
        />
      </div>
      <div className="w-9 flex-none text-right text-xs tabular-nums text-slate-500 dark:text-zinc-400">{pct(prob)}</div>
    </div>
  );
}

function BoolMeter({ label, prob }: { label: string; prob: number }) {
  const yes = prob >= 0.5;
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/70 p-3 ring-1 ring-slate-900/[0.03] dark:border-white/5 dark:bg-white/5 dark:ring-white/5">
      <div className="text-xs font-medium text-slate-500 dark:text-zinc-400">
        {label} <span className="opacity-60">(Noul)</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${yes ? "bg-emerald-500" : "bg-slate-300 dark:bg-white/25"}`}
            style={{ width: pct(prob) }}
          />
        </div>
        <span className={`text-sm font-semibold tabular-nums ${yes ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-zinc-400"}`}>
          {pct(prob)}
        </span>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: "jev" | "demo" }) {
  if (source === "jev") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live Jev
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Demo (not real Jev)
    </span>
  );
}
