"use client";

// Lightweight, dependency-free SVG charts that adapt to light/dark via
// Tailwind fill/stroke color utilities.

export type RadarDatum = { label: string; value: number }; // value 0..1

export function RadarChart({
  data,
  size = 150,
  showLabels = true,
}: {
  data: RadarDatum[];
  size?: number;
  showLabels?: boolean;
}) {
  const n = data.length;
  const pad = showLabels ? 26 : 10;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - pad;
  const rings = [0.33, 0.66, 1];

  const pointAt = (i: number, radius: number) => {
    const angle = (-90 + (i * 360) / n) * (Math.PI / 180);
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as const;
  };

  const ringPoly = (f: number) =>
    data.map((_, i) => pointAt(i, r * f).join(",")).join(" ");

  const valuePoly = data
    .map((d, i) => pointAt(i, r * Math.max(0, Math.min(1, d.value))).join(","))
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="overflow-visible">
      {/* grid rings */}
      {rings.map((f) => (
        <polygon
          key={f}
          points={ringPoly(f)}
          className="fill-none stroke-slate-200 dark:stroke-white/10"
          strokeWidth={1}
        />
      ))}
      {/* axes */}
      {data.map((_, i) => {
        const [x, y] = pointAt(i, r);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="stroke-slate-200 dark:stroke-white/10" strokeWidth={1} />;
      })}
      {/* value polygon */}
      <polygon points={valuePoly} className="fill-slate-900/10 stroke-slate-900 dark:fill-white/15 dark:stroke-white" strokeWidth={1.5} />
      {/* vertices */}
      {data.map((d, i) => {
        const [x, y] = pointAt(i, r * Math.max(0, Math.min(1, d.value)));
        return <circle key={i} cx={x} cy={y} r={2.5} className="fill-slate-900 dark:fill-white" />;
      })}
      {/* labels */}
      {showLabels &&
        data.map((d, i) => {
          const [x, y] = pointAt(i, r + 12);
          const cos = Math.cos((-90 + (i * 360) / n) * (Math.PI / 180));
          const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-slate-500 text-[10px] font-medium dark:fill-zinc-400"
            >
              {d.label}
            </text>
          );
        })}
    </svg>
  );
}

export function Bar({
  value,
  tone = "navy",
}: {
  value: number; // 0..1
  tone?: "navy" | "emerald" | "rose" | "amber";
}) {
  const fill =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "rose"
        ? "bg-rose-500"
        : tone === "amber"
          ? "bg-amber-500"
          : "bg-slate-900 dark:bg-white";
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
      <div className={`h-full rounded-full transition-all duration-500 ${fill}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

export function LabeledBar({
  label,
  value,
  tone = "navy",
}: {
  label: string;
  value: number;
  tone?: "navy" | "emerald" | "rose" | "amber";
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-28 flex-none truncate text-xs text-slate-500 dark:text-zinc-400">{label}</div>
      <Bar value={value} tone={tone} />
      <div className="w-9 flex-none text-right text-xs tabular-nums text-slate-500 dark:text-zinc-400">
        {Math.round(value * 100)}%
      </div>
    </div>
  );
}
