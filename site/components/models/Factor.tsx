"use client";
import { useState } from "react";
import { money, pct } from "@/lib/format";
import { FACTORS, factorScores, isNum } from "@/lib/models";
import { DivergingBars, SERIES } from "./charts";
import { Explainer, Note, NumField, ScrollTable } from "./parts";
import type { ModelProps, Side } from "./ModelLab";

const fmtRaw = (key: string, v: number | null) => {
  if (v == null) return "—";
  if (key === "size") return money(Math.exp(v));
  if (key === "stability") return `±${pct(-v)}`;
  return pct(v);
};

export default function Factor({ a, b, universe, priceOf }: ModelProps) {
  const sides = [a, b].filter(Boolean) as Side[];
  const prices: Record<number, number | null> = Object.fromEntries(universe.map((c) => [c.cik, priceOf(c)]));
  for (const s of sides) prices[s.c.cik] = s.price;
  const score = factorScores(universe, prices);
  const [weights, setWeights] = useState<Record<string, number>>({ size: 0, growth: 1, profitability: 1, quality: 1, lowLeverage: 1, stability: 1, value: 1 });
  const res = sides.map((s) => score(s.c, s.price));

  const composite = (rows: ReturnType<typeof score>) => {
    let t = 0, w = 0;
    for (const r of rows) { const wt = weights[r.key] ?? 0; if (r.z != null && wt) { t += r.z * wt; w += Math.abs(wt); } }
    return w ? t / w : null;
  };
  const ranked = universe.map((c) => ({ c, z: composite(score(c, prices[c.cik] ?? null)) })).filter((x) => x.z != null).sort((x, y) => y.z! - x.z!);
  const rankOf = (cik: number) => ranked.findIndex((x) => x.c.cik === cik) + 1;

  return (
    <div>
      <p className="text-sm text-muted mb-3">Each company is scored against all {universe.length} North Carolina public companies on this site. A score of +1 means one standard deviation above the group average; 0 is average.</p>
      {res[0] && (res[0].find((r) => r.key === "value")?.n ?? 0) < 5 && <div className="mb-3"><Note>The Value factor needs share prices for most of the group, which aren&apos;t loaded yet, so it shows n/a. The other six factors use filings only.</Note></div>}
      <DivergingBars title="Factor exposures (z-scores vs NC public companies)" names={sides.map((s) => s.c.ticker ?? s.c.name)}
        rows={FACTORS.map((f, i) => ({ label: f.label, values: res.map((r) => r[i].z) }))} />
      <div className="mt-4">
        <ScrollTable>
          <thead><tr className="border-b border-rule text-xs uppercase tracking-wide text-muted text-right">
            <th className="p-2 text-left">Factor</th><th className="p-2 text-left">Measured as</th>
            {sides.map((s, i) => <th key={s.c.cik} className="p-2" colSpan={3} style={{ color: SERIES[i] }}>{s.c.ticker ?? s.c.name}: raw · z · percentile</th>)}
            <th className="p-2">Weight</th>
          </tr></thead>
          <tbody>
            {FACTORS.map((f, fi) => (
              <tr key={f.key} className="border-b border-rule">
                <td className="p-2 font-medium">{f.label}</td><td className="p-2 text-xs text-muted min-w-48">{f.describe}</td>
                {res.map((r, i) => (
                  <Cells key={i} raw={fmtRaw(f.key, r[fi].raw)} z={r[fi].z} p={r[fi].pctRank} />
                ))}
                <td className="p-1 w-20"><NumField label="" value={weights[f.key]} step={0.5} onChange={(v) => setWeights((w) => ({ ...w, [f.key]: v ?? 0 }))} /></td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="p-2" colSpan={2}>Composite score (weighted average z)</td>
              {res.map((r, i) => <td key={i} colSpan={3} className="p-2 text-right">{composite(r)?.toFixed(2) ?? "—"} <span className="text-xs text-muted font-normal">rank {rankOf(sides[i].c.cik) || "—"} of {ranked.length}</span></td>)}
              <td />
            </tr>
          </tbody>
        </ScrollTable>
      </div>
      <h3 className="mt-6 font-serif text-lg font-semibold mb-2">Top 10 by your weights</h3>
      <ol className="grid gap-1 sm:grid-cols-2 text-sm">
        {ranked.slice(0, 10).map((x, i) => <li key={x.c.cik} className="flex justify-between gap-3 border-b border-rule py-1"><span>{i + 1}. {x.c.name} <span className="text-muted">{x.c.ticker}</span></span><span className="num">{x.z!.toFixed(2)}</span></li>)}
      </ol>
      <p className="mt-2 text-xs text-muted">Change the weights to build your own screen. Set a weight to 0 to ignore a factor, or make it negative to favor the opposite (for example, small companies).</p>
      <Explainer
        does={<>A factor model describes a stock by a handful of traits (&quot;factors&quot;) such as size, value, quality, growth and leverage, and measures how strongly each company shows each trait compared with a group. Scores are standardized so different units can be compared.</>}
        purpose={<>Academic research (Fama and French&apos;s work is the best known) found that a few traits explain much of why stocks behave differently. Quant funds and index providers use factor scores to build portfolios, and risk systems use them to see what bets a portfolio is really making.</>}
        uses={<>See what kind of company you&apos;re looking at: a large, steady, low-debt business, or a small, fast-growing, highly leveraged one. Build a simple multi-factor screen with the weights and see which local companies rank highest.</>}
        limits={<>This is a characteristics model built from annual filings. Professional factor models also regress daily stock returns on factor returns across thousands of stocks, which needs a long price history. The group here is about 100 NC companies, so scores are relative to that small pool, and a few extreme values can move the averages (scores are capped at ±3).</>}
      />
    </div>
  );
}

function Cells({ raw, z, p }: { raw: string; z: number | null; p: number | null }) {
  return (
    <>
      <td className="p-2 text-right whitespace-nowrap">{raw}</td>
      <td className={`p-2 text-right ${isNum(z) ? (z > 0 ? "text-pos" : z < 0 ? "text-neg" : "") : ""}`}>{z == null ? "n/a" : `${z > 0 ? "+" : ""}${z.toFixed(2)}`}</td>
      <td className="p-2 text-right text-muted">{p == null ? "—" : `${Math.round(p * 100)}th`}</td>
    </>
  );
}
