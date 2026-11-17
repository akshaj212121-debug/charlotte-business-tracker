// Minimal server-rendered SVG bar chart for a short annual series (handles negative values).
import { money } from "@/lib/format";

interface Point { label: string; value: number | null }

export default function BarChart({ title, points }: { title: string; points: Point[] }) {
  const data = [...points].reverse(); // oldest → newest, left → right
  const values = data.map((p) => p.value ?? 0);
  const max = Math.max(0, ...values), min = Math.min(0, ...values);
  const span = max - min || 1;
  const W = 320, H = 150, pad = 18, barW = (W - pad * 2) / Math.max(data.length, 1);
  const y0 = pad + ((max - 0) / span) * (H - pad * 2);
  if (!data.some((p) => p.value != null)) return null;
  return (
    <figure className="rounded-md border border-rule bg-card p-3">
      <figcaption className="text-xs uppercase tracking-wide text-muted mb-1">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full h-auto" role="img" aria-label={`${title}: ${data.map((p) => `${p.label} ${money(p.value)}`).join(", ")}`}>
        <line x1={pad} x2={W - pad} y1={y0} y2={y0} stroke="var(--rule)" />
        {data.map((p, i) => {
          if (p.value == null) return null;
          const h = (Math.abs(p.value) / span) * (H - pad * 2);
          const x = pad + i * barW + barW * 0.18;
          const y = p.value >= 0 ? y0 - h : y0;
          return (
            <g key={p.label}>
              <rect x={x} y={y} width={barW * 0.64} height={Math.max(h, 1)} rx={2} fill={p.value >= 0 ? "var(--accent)" : "var(--neg)"} />
              <text x={x + barW * 0.32} y={p.value >= 0 ? y - 4 : y + h + 11} textAnchor="middle" fontSize="9" fill="var(--muted)">{money(p.value)}</text>
              <text x={x + barW * 0.32} y={H + 12} textAnchor="middle" fontSize="9" fill="var(--muted)">{p.label}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
