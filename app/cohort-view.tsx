"use client";

import { useEffect, useState } from "react";
import {
  MASTERY_SKILLS,
  NEED_LABELS,
  SKILL_LABELS,
  avgMastery,
  isSecure,
  type ProfileFlag,
  type SkillId,
  type StudentProfile,
} from "@/lib/data";
import { LabeledBar, RadarChart, type RadarDatum } from "@/components/charts";

const SHORT: Record<SkillId, string> = {
  evaporation_basics: "Evap",
  condensation: "Cond",
  precipitation: "Precip",
  apply_real_world: "Apply",
};

const CARD =
  "rounded-3xl border border-white/70 bg-white/70 shadow-[0_2px_16px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:ring-white/5";

function flagClasses(tone: ProfileFlag["tone"]) {
  switch (tone) {
    case "risk":
      return "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
    case "review":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200";
    case "ready":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-zinc-300";
  }
}

function radarData(p: StudentProfile): RadarDatum[] {
  return MASTERY_SKILLS.map((s) => ({ label: SHORT[s], value: p.mastery[s] ?? 0 }));
}

function needLabel(p: StudentProfile): string {
  return isSecure(p.mastery, p.readyToAdvance, p.atRisk)
    ? "Secure · ready to advance"
    : NEED_LABELS[p.likelyNeed];
}

export default function CohortView() {
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [jevError, setJevError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cohort");
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to load cohort.");
        return;
      }
      const list = (data.profiles ?? []) as StudentProfile[];
      setProfiles(list);
      setNotice(data.notice ?? null);
      setJevError(data.jevError ?? null);
      setSelectedId((prev) => prev ?? list[0]?.studentId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = profiles.find((p) => p.studentId === selectedId) ?? null;
  const source = profiles[0]?.jev.source ?? "demo";

  const atRiskCount = profiles.filter((p) => p.flags.some((f) => f.label === "At risk")).length;
  const reviewCount = profiles.filter((p) => p.likelyNeed === "insufficient_evidence").length;
  const readyCount = profiles.filter((p) => p.flags.some((f) => f.label === "Ready to advance")).length;

  return (
    <div className="space-y-6">
      {/* summary strip */}
      <div className="flex flex-wrap items-center gap-3">
        <SourceBadge source={source} />
        <Stat label="Students" value={profiles.length} />
        <Stat label="At risk" value={atRiskCount} tone="rose" />
        <Stat label="Needs evidence" value={reviewCount} tone="amber" />
        <Stat label="Ready to advance" value={readyCount} tone="emerald" />
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {notice && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {notice}
          {jevError ? <span className="mt-1 block font-mono opacity-80">{jevError}</span> : null}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {/* roster */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {profiles.map((p) => {
          const active = p.studentId === selectedId;
          return (
            <button
              key={p.studentId}
              onClick={() => setSelectedId(p.studentId)}
              className={`flex flex-col gap-3 p-4 text-left transition-all duration-200 ${CARD} ${
                active ? "ring-2 ring-slate-900/30 dark:ring-white/30" : "hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold tracking-tight">{p.studentName}</div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400">{needLabel(p)}</div>
                </div>
                <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-sm font-bold tabular-nums text-slate-700 dark:bg-white/10 dark:text-zinc-200">
                  {p.score}%
                </span>
              </div>

              <div className="flex items-center gap-3">
                <RadarChart data={radarData(p)} size={116} showLabels={false} />
                <div className="flex-1 space-y-2">
                  <MiniStat label="Mastery" value={avgMastery(p.mastery)} tone="navy" />
                  <MiniStat label="Ready" value={p.readyToAdvance} tone="emerald" />
                  <MiniStat label="At risk" value={p.atRisk} tone="rose" />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {p.flags.map((f, i) => (
                  <span key={i} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${flagClasses(f.tone)}`}>
                    {f.label}
                  </span>
                ))}
              </div>
            </button>
          );
        })}

        {loading && profiles.length === 0 && (
          <div className={`p-8 text-center text-sm text-slate-500 sm:col-span-2 xl:col-span-3 ${CARD}`}>
            Asking Jev for every student&apos;s understanding profile…
          </div>
        )}
      </div>

      {/* detail */}
      {selected && (
        <section className={`p-6 ${CARD}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Understanding profile · {selected.studentName}
            </h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 dark:bg-white/10 dark:text-zinc-300">
                {selected.jev.model}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium tabular-nums text-slate-600 dark:bg-white/10 dark:text-zinc-300">
                {selected.jev.latencyMs} ms
              </span>
            </div>
          </div>

          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-zinc-300">{selected.summary}</p>

          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {/* radar + flags */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/5 dark:bg-black/20">
              <div className="mb-1 self-start text-xs font-medium text-slate-500 dark:text-zinc-400">
                Skill mastery (Jev Score per stage)
              </div>
              <RadarChart data={radarData(selected)} size={210} />
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {selected.flags.map((f, i) => (
                  <span key={i} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${flagClasses(f.tone)}`}>
                    {f.label}
                  </span>
                ))}
              </div>
            </div>

            {/* bars */}
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-zinc-400">Mastery per stage</div>
                <div className="space-y-2">
                  {MASTERY_SKILLS.map((s) => (
                    <LabeledBar key={s} label={SKILL_LABELS[s]} value={selected.mastery[s] ?? 0} />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-zinc-400">
                  Propensity <span className="opacity-60">(Jev Noul)</span>
                </div>
                <div className="space-y-2">
                  <LabeledBar label="Ready to advance" value={selected.readyToAdvance} tone="emerald" />
                  <LabeledBar label="At risk" value={selected.atRisk} tone="rose" />
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-zinc-400">
                  Misconception &amp; application <span className="opacity-60">(Jev Noul)</span>
                </div>
                <div className="space-y-2">
                  <LabeledBar label="“Water is gone”" value={selected.misconceptionWaterGone} tone="rose" />
                  <LabeledBar label="“Clouds = sponge”" value={selected.misconceptionCloudSponge} tone="rose" />
                  <LabeledBar label="Can apply to new case" value={selected.canApply} tone="emerald" />
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium text-slate-500 dark:text-zinc-400">
                  Likely need <span className="opacity-60">(Jev Choice)</span>
                </div>
                <div className="space-y-2">
                  {(["prerequisite_gap", "conceptual_misunderstanding", "application_difficulty", "insufficient_evidence"] as const).map(
                    (n) => (
                      <LabeledBar
                        key={n}
                        label={NEED_LABELS[n]}
                        value={selected.needProbabilities[n] ?? 0}
                        tone={selected.likelyNeed === n ? "navy" : "navy"}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "rose" | "amber" | "emerald" }) {
  const dot =
    tone === "rose" ? "bg-rose-500" : tone === "amber" ? "bg-amber-500" : tone === "emerald" ? "bg-emerald-500" : "bg-slate-400";
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/60 px-3 py-1.5 text-xs ring-1 ring-slate-900/[0.03] dark:border-white/10 dark:bg-white/[0.04] dark:ring-white/5">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="font-bold tabular-nums text-slate-800 dark:text-zinc-100">{value}</span>
      <span className="text-slate-500 dark:text-zinc-400">{label}</span>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "navy" | "emerald" | "rose" }) {
  const fill = tone === "emerald" ? "bg-emerald-500" : tone === "rose" ? "bg-rose-500" : "bg-slate-900 dark:bg-white";
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 flex-none text-[11px] text-slate-500 dark:text-zinc-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
      </div>
      <span className="w-8 flex-none text-right text-[11px] tabular-nums text-slate-500 dark:text-zinc-400">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

function SourceBadge({ source }: { source: "jev" | "demo" }) {
  if (source === "jev") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live Jev
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Demo (not real Jev)
    </span>
  );
}
