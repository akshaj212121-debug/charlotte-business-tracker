"use client";
// Small dependency-free SVG charts for the models section. Colors come from CSS variables so light and dark both work.

export const SERIES = ["var(--accent)", "var(--series-b)", "var(--muted)", "var(--series-c)"];

interface Series { name: string; values: (number | null)[]; color?: string; dashed?: boolean }

export function LineChart({ title, labels, series, format, height = 200, shadeFrom }: {
  title: string; labels: string[]; series: Series[]; format: (n: number) => string; height?: number; shadeFrom?: number;
}) {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null && Number.isFinite(v));
  if (!all.length) return <EmptyChart title={title} />;
  const W = 560, H = height, padL = 62, padR = 24, padT = 12, padB = 26;
  let min = Math.min(...all), max = Math.max(...all);
  if (min > 0 && min / (max || 1) < 0.6) min = 0;
  if (min === max) { min -= Math.abs(min) * 0.1 || 1; max += Math.abs(max) * 0.1 || 1; }
  const x = (i: number) => padL + (labels.length <= 1 ? 0 : (i / (labels.length - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + t * (max - min));
  const every = Math.max(1, Math.ceil(labels.length / 8));
  return (
    <figure className="rounded-md border border-rule bg-card p-3 min-w-0">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mb-1">
        <span className="uppercase tracking-wide">{title}</span>
        {series.map((s, i) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden><line x1="0" x2="16" y1="2" y2="2" stroke={s.color ?? SERIES[i]} strokeWidth="2.5" strokeDasharray={s.dashed ? "4 3" : undefined} /></svg>
            {s.name}
          </span>
        ))}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${title}. ${series.map((s) => `${s.name}: ${s.values.map((v, i) => `${labels[i]} ${v == null ? "n/a" : format(v)}`).join(", ")}`).join(". ")}`}>
        {shadeFrom != null && shadeFrom < labels.length && (
          <rect x={x(shadeFrom) - 6} y={padT} width={W - padR - x(shadeFrom) + 6} height={H - padT - padB} fill="var(--accent-soft)" opacity="0.6" />
        )}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{format(t)}</text>
          </g>
        ))}
        {min < 0 && max > 0 && <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="var(--muted)" strokeWidth="1" />}
        {labels.map((l, i) => (i % every === 0 || i === labels.length - 1) && (
          <text key={l + i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{l}</text>
        ))}
        {series.map((s, si) => {
          const color = s.color ?? SERIES[si];
          const segs: string[] = [];
          let cur = "";
          s.values.forEach((v, i) => {
            if (v == null || !Number.isFinite(v)) { if (cur) segs.push(cur); cur = ""; return; }
            cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
          });
          if (cur) segs.push(cur);
          return (
            <g key={s.name}>
              {segs.map((d, k) => <path key={k} d={d} fill="none" stroke={color} strokeWidth="2.25" strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" />)}
              {labels.length <= 16 && s.values.map((v, i) => v != null && Number.isFinite(v) && <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={color}><title>{`${s.name}, ${labels[i]}: ${format(v)}`}</title></circle>)}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function BarGroups({ title, labels, series, format, height = 200 }: {
  title: string; labels: string[]; series: Series[]; format: (n: number) => string; height?: number;
}) {
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null && Number.isFinite(v));
  if (!all.length) return <EmptyChart title={title} />;
  const W = 560, H = height, padL = 62, padR = 24, padT = 14, padB = 26;
  const max = Math.max(0, ...all), min = Math.min(0, ...all);
  const span = max - min || 1;
  const y = (v: number) => padT + ((max - v) / span) * (H - padT - padB);
  const groupW = (W - padL - padR) / labels.length;
  const barW = (groupW * 0.72) / series.length;
  return (
    <figure className="rounded-md border border-rule bg-card p-3 min-w-0">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mb-1">
        <span className="uppercase tracking-wide">{title}</span>
        {series.length > 1 && series.map((s, i) => (
          <span key={s.name} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color ?? SERIES[i] }} />{s.name}</span>
        ))}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${title}. ${series.map((s) => `${s.name}: ${s.values.map((v, i) => `${labels[i]} ${v == null ? "n/a" : format(v)}`).join(", ")}`).join(". ")}`}>
        {[0, 0.5, 1].map((t) => { const v = min + t * span; return (
          <g key={t}><line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--rule)" /><text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{format(v)}</text></g>
        ); })}
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} stroke="var(--muted)" />
        {labels.map((l, gi) => (
          <g key={l + gi}>
            {series.map((s, si) => {
              const v = s.values[gi];
              if (v == null || !Number.isFinite(v)) return null;
              const bx = padL + gi * groupW + groupW * 0.14 + si * barW;
              const top = Math.min(y(v), y(0)), h = Math.max(1, Math.abs(y(v) - y(0)));
              return <rect key={si} x={bx} y={top} width={barW - 1.5} height={h} rx="2" fill={v < 0 && series.length === 1 ? "var(--neg)" : s.color ?? SERIES[si]}><title>{`${s.name}, ${l}: ${format(v)}`}</title></rect>;
            })}
            <text x={padL + gi * groupW + groupW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{l}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

/** Horizontal diverging bars around zero, for z-scores. */
export function DivergingBars({ title, rows, names, domain = 3 }: {
  title: string; rows: { label: string; values: (number | null)[] }[]; names: string[]; domain?: number;
}) {
  const W = 560, rowH = 16 * names.length + 12, padL = 110, padR = 16;
  const H = rows.length * rowH + 24;
  const x = (v: number) => padL + ((v + domain) / (2 * domain)) * (W - padL - padR);
  return (
    <figure className="rounded-md border border-rule bg-card p-3 min-w-0">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mb-1">
        <span className="uppercase tracking-wide">{title}</span>
        {names.map((n, i) => <span key={n} className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i] }} />{n}</span>)}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${title}. ${rows.map((r) => `${r.label}: ${r.values.map((v, i) => `${names[i]} ${v == null ? "n/a" : v.toFixed(2)}`).join(", ")}`).join(". ")}`}>
        {[-domain, -domain / 2, 0, domain / 2, domain].map((t) => (
          <g key={t}><line x1={x(t)} x2={x(t)} y1={4} y2={H - 18} stroke={t === 0 ? "var(--muted)" : "var(--rule)"} /><text x={x(t)} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--muted)">{t > 0 ? `+${t}` : t}</text></g>
        ))}
        {rows.map((r, ri) => (
          <g key={r.label}>
            <text x={padL - 8} y={ri * rowH + rowH / 2 + 6} textAnchor="end" fontSize="11" fill="var(--ink)">{r.label}</text>
            {r.values.map((v, vi) => {
              const yy = ri * rowH + 8 + vi * 16;
              if (v == null) return <text key={vi} x={x(0) + 4} y={yy + 10} fontSize="10" fill="var(--muted)">n/a</text>;
              return <rect key={vi} x={Math.min(x(0), x(v))} y={yy} width={Math.max(1.5, Math.abs(x(v) - x(0)))} height="12" rx="2" fill={SERIES[vi]}><title>{`${names[vi]}, ${r.label}: ${v.toFixed(2)} standard deviations`}</title></rect>;
            })}
          </g>
        ))}
      </svg>
    </figure>
  );
}

export function Histogram({ title, values, bins = 30, format, markers = [] }: {
  title: string; values: number[]; bins?: number; format: (n: number) => string; markers?: { value: number; label: string; color?: string }[];
}) {
  const v = values.filter(Number.isFinite);
  if (!v.length) return <EmptyChart title={title} />;
  const sorted = [...v].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.01)], hi = sorted[Math.floor(sorted.length * 0.99)];
  const w = (hi - lo) / bins || 1;
  const counts = Array(bins).fill(0);
  for (const x of v) { if (x < lo || x > hi) continue; counts[Math.min(bins - 1, Math.floor((x - lo) / w))]++; }
  const maxC = Math.max(...counts);
  const W = 560, H = 190, padL = 12, padR = 12, padT = 18, padB = 26;
  const xs = (x: number) => padL + ((x - lo) / (hi - lo || 1)) * (W - padL - padR);
  return (
    <figure className="rounded-md border border-rule bg-card p-3 min-w-0">
      <figcaption className="text-xs uppercase tracking-wide text-muted mb-1">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${title}. ${markers.map((m) => `${m.label} ${format(m.value)}`).join(", ")}`}>
        {counts.map((c, i) => {
          const h = (c / maxC) * (H - padT - padB);
          return <rect key={i} x={xs(lo + i * w) + 0.5} y={H - padB - h} width={Math.max(1, xs(lo + (i + 1) * w) - xs(lo + i * w) - 1)} height={h} fill="var(--accent)" opacity="0.75" />;
        })}
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--muted)" />
        {[lo, (lo + hi) / 2, hi].map((t, i) => <text key={i} x={xs(t)} y={H - 8} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} fontSize="10" fill="var(--muted)">{format(t)}</text>)}
        {markers.filter((m) => m.value >= lo && m.value <= hi).map((m, i) => (
          <g key={m.label}>
            <line x1={xs(m.value)} x2={xs(m.value)} y1={padT - 4} y2={H - padB} stroke={m.color ?? "var(--ink)"} strokeDasharray="4 3" strokeWidth="1.5" />
            <text x={xs(m.value)} y={padT - 6 + (i % 2) * 0} textAnchor="middle" fontSize="10" fill={m.color ?? "var(--ink)"}>{m.label}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

function EmptyChart({ title }: { title: string }) {
  return (
    <div className="rounded-md border border-dashed border-rule bg-card p-6 text-sm text-muted">
      <p className="text-xs uppercase tracking-wide mb-1">{title}</p>
      Not enough filed data to draw this chart.
    </div>
  );
}
