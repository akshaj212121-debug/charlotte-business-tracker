"use client";
import { useMemo, useState } from "react";
import { money, perShare, pct, signedPct } from "@/lib/format";
import { annualVol, clamp, correlation, dailyReturns, growthRates, isNum, linreg, mean, mulberry32, netDebt, normal, stdev } from "@/lib/models";
import { Histogram, LineChart, SERIES } from "./charts";
import { Explainer, KV, Note, NumField, Panel, PctField } from "./parts";
import { dcfDefaults } from "./Dcf";
import type { ModelProps, Side } from "./ModelLab";
import { useWhich } from "./which";

function trend(s: Side) {
  const pts = s.c.years.filter((y) => isNum(y.revenue) && y.revenue > 0).map((y) => ({ yr: Number(y.end.slice(0, 4)), v: y.revenue! }));
  if (pts.length < 3) return null;
  const fit = linreg(pts.map((p) => p.yr), pts.map((p) => Math.log(p.v)));
  return { pts, fit, growth: Math.exp(fit.slope) - 1 };
}

export default function Quant(props: ModelProps) {
  const { a, b } = props;
  const sides = [a, b].filter(Boolean) as Side[];
  const trends = sides.map(trend);
  const allYears = [...new Set(trends.flatMap((t) => t?.pts.map((p) => p.yr) ?? []))].sort();
  const lastYr = allYears[allYears.length - 1];
  const labels = allYears.length ? [...allYears, lastYr + 1, lastYr + 2].map((y) => `FY${y}`) : [];
  const yrs = allYears.length ? [...allYears, lastYr + 1, lastYr + 2] : [];
  const series = sides.flatMap((s, i) => {
    const t = trends[i];
    if (!t) return [];
    const name = s.c.ticker ?? s.c.name;
    return [
      { name: `${name} actual`, color: SERIES[i], values: yrs.map((y) => t.pts.find((p) => p.yr === y)?.v ?? null) },
      { name: `${name} trend`, color: SERIES[i], dashed: true, values: yrs.map((y) => Math.exp(t.fit.intercept + t.fit.slope * y)) },
    ];
  });

  let growthCorr: { r: number; n: number } | null = null;
  let priceStats: { corr: number; beta: number; n: number } | null = null;
  if (b) {
    const ga = new Map<string, number>(), gb = new Map<string, number>();
    const gr = (s: Side, m: Map<string, number>) => s.c.years.forEach((y, i) => { const p = s.c.years[i - 1]; if (p && isNum(p.revenue) && p.revenue > 0 && isNum(y.revenue)) m.set(y.end.slice(0, 4), y.revenue / p.revenue - 1); });
    gr(a, ga); gr(b, gb);
    const common = [...ga.keys()].filter((k) => gb.has(k)).sort();
    growthCorr = { r: correlation(common.map((k) => ga.get(k)!), common.map((k) => gb.get(k)!)), n: common.length };
    if (a.c.closes && b.c.closes) {
      const mb = new Map(b.c.closes);
      const pairs = a.c.closes.filter(([d]) => mb.has(d)).map(([d, p]) => [p, mb.get(d)!] as [number, number]);
      const ra: number[] = [], rb: number[] = [];
      for (let i = 1; i < pairs.length; i++) { ra.push(pairs[i][0] / pairs[i - 1][0] - 1); rb.push(pairs[i][1] / pairs[i - 1][1] - 1); }
      if (ra.length > 40) { const fit = linreg(rb, ra); priceStats = { corr: correlation(ra, rb), beta: fit.slope, n: ra.length }; }
    }
  }

  return (
    <div>
      <h3 className="font-serif text-lg font-semibold mb-2">1. Trend regression on revenue</h3>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <LineChart title="Revenue with fitted log-linear trend (dashed), extended two years" labels={labels} series={series} format={(v) => money(v, 0)} shadeFrom={allYears.length} />
        <Panel title="Regression results">
          {sides.map((s, i) => {
            const t = trends[i];
            return (
              <div key={s.c.cik} className="mb-3 last:mb-0">
                <p className="text-sm font-medium" style={{ color: SERIES[i] }}>{s.c.ticker ?? s.c.name}</p>
                {t ? (<>
                  <KV label="Trend growth per year" value={signedPct(t.growth)} />
                  <KV label="R² (share of variation the line explains)" value={t.fit.r2.toFixed(2)} />
                  <KV label="Data points" value={String(t.fit.n)} />
                </>) : <p className="text-sm text-muted">Needs at least 3 years of positive revenue.</p>}
              </div>
            );
          })}
          <p className="text-xs text-muted mt-2">With only 3 to 5 annual points, treat R² as a rough guide. One unusual year moves the line a lot.</p>
        </Panel>
      </div>

      {b && (
        <>
          <h3 className="mt-8 font-serif text-lg font-semibold mb-2">2. Correlation between {a.c.ticker ?? a.c.name} and {b.c.ticker ?? b.c.name}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Yearly revenue growth">
              <KV label="Correlation" value={growthCorr && isNum(growthCorr.r) ? growthCorr.r.toFixed(2) : "—"} strong />
              <KV label="Overlapping years" value={String(growthCorr?.n ?? 0)} />
              <p className="text-xs text-muted mt-2">{growthCorr && growthCorr.n < 3 ? "Needs at least 3 overlapping years." : "Ranges from −1 (opposite) to +1 (move together). With so few years this is suggestive at best; a correlation from 4 points can easily be chance."}</p>
            </Panel>
            <Panel title="Daily stock returns">
              {priceStats ? (<>
                <KV label="Correlation" value={priceStats.corr.toFixed(2)} strong />
                <KV label={`Beta of ${a.c.ticker} to ${b.c.ticker}`} value={priceStats.beta.toFixed(2)} />
                <KV label="Trading days" value={String(priceStats.n)} />
              </>) : <p className="text-sm text-muted">Fills in when daily prices are loaded for both companies.</p>}
            </Panel>
          </div>
        </>
      )}

      <MonteCarlo {...props} />
      <PriceSignals sides={sides} />

      <Explainer
        does={<>Applies statistics to the data. <b>Regression</b> fits a trend line and says how well it fits. <b>Correlation</b> measures whether two companies move together. <b>Monte Carlo simulation</b> reruns a valuation thousands of times with random inputs to show the range of outcomes rather than one number. <b>Price signals</b> like momentum and mean reversion summarize recent price behavior.</>}
        purpose={<>Systematic (&quot;quant&quot;) funds build on these same building blocks, at far larger scale: thousands of stocks, decades of data, and strict testing to avoid finding patterns that are just noise. Banks use Monte Carlo for risk and for pricing complex securities.</>}
        uses={<>Check whether a company&apos;s growth has been steady or erratic, whether two local companies tend to rise and fall together (useful for diversification), and how wide the honest range of values is for a stock.</>}
        limits={<>Annual filings give only 3 to 5 data points per company, far too few for reliable statistics, and the page says so where it matters. Price-based results need the daily price file. Past patterns are not predictions. Nothing here is a trading signal.</>}
      />
    </div>
  );
}

function MonteCarlo({ a, b }: ModelProps) {
  const { s, control } = useWhich(a, b);
  const d = dcfDefaults(s);
  const histSd = stdev(growthRates(s.c.years.map((y) => y.revenue)));
  const [sd, setSd] = useState(isNum(histSd) ? clamp(histSd, 0.02, 0.25) : 0.08);
  const [waccSd, setWaccSd] = useState(0.01);
  const [runs, setRuns] = useState(5000);
  const [seed, setSeed] = useState(1);
  const nd = netDebt(s.c);
  const out = useMemo(() => {
    if (d.fcf0 == null || d.fcf0 <= 0 || !s.shares) return null;
    const rand = mulberry32(seed * 7919 + s.c.cik);
    const vals: number[] = [];
    for (let k = 0; k < runs; k++) {
      const w = clamp(d.wacc + normal(rand) * waccSd, 0.04, 0.2);
      const tg = clamp(d.terminalGrowth + normal(rand) * 0.005, 0, w - 0.01);
      let f = d.fcf0, pv = 0;
      for (let t = 1; t <= 5; t++) { f *= 1 + d.growth + normal(rand) * sd; pv += f / (1 + w) ** t; }
      const tv = (f * (1 + tg)) / (w - tg) / (1 + w) ** 5;
      vals.push((pv + tv - nd) / s.shares);
    }
    const sorted = [...vals].sort((x, y) => x - y);
    const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))];
    return { vals, p10: q(0.1), p50: q(0.5), p90: q(0.9), mean: mean(vals), above: s.price ? vals.filter((v) => v > s.price!).length / vals.length : null };
  }, [d.fcf0, d.growth, d.wacc, d.terminalGrowth, sd, waccSd, runs, seed, nd, s.shares, s.price, s.c.cik]);

  return (
    <>
      <h3 className="mt-8 font-serif text-lg font-semibold mb-2">3. Monte Carlo valuation</h3>
      {control}
      {!out ? <Note tone="warn">Needs positive free cash flow and a share count for {s.c.name}. Banks and companies with negative cash flow can&apos;t be simulated with this DCF.</Note> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
          <Panel title="Simulation settings">
            <div className="grid grid-cols-2 gap-3">
              <PctField label="Growth uncertainty (std. dev.)" value={sd} onChange={setSd} hint={isNum(histSd) ? `Default from history: ${pct(histSd)} per year (capped 2–25%).` : undefined} />
              <PctField label="Discount-rate uncertainty" value={waccSd} step={0.25} onChange={setWaccSd} />
              <NumField label="Simulations" value={runs} step={1000} min={500} max={20000} onChange={(v) => setRuns(clamp(Math.round(v ?? 5000), 500, 20000))} />
              <div className="flex items-end"><button type="button" onClick={() => setSeed((x) => x + 1)} className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent-soft">Re-run</button></div>
            </div>
            <p className="mt-2 text-xs text-muted">Centered on the DCF tab&apos;s defaults: {pct(d.growth)} growth, {pct(d.wacc)} discount rate, {pct(d.terminalGrowth)} terminal growth. Each year&apos;s growth is drawn at random.</p>
            <div className="mt-3">
              <KV label="10th percentile" value={perShare(out.p10)} />
              <KV label="Median" value={perShare(out.p50)} strong />
              <KV label="90th percentile" value={perShare(out.p90)} />
              <KV label="Share of runs above price" value={out.above == null ? "—" : pct(out.above, 0)} />
            </div>
          </Panel>
          <Histogram title={`${runs.toLocaleString()} simulated values per share`} values={out.vals} format={(v) => `$${v.toFixed(0)}`}
            markers={[{ value: out.p10, label: "P10" }, { value: out.p50, label: "Median" }, { value: out.p90, label: "P90" }, ...(s.price ? [{ value: s.price, label: "Price", color: "var(--series-b)" }] : [])]} />
        </div>
      )}
    </>
  );
}

function PriceSignals({ sides }: { sides: Side[] }) {
  const rows = sides.filter((s) => s.c.closes && s.c.closes.length > 60).map((s) => {
    const cl = s.c.closes!;
    const p = cl.map((x) => x[1]);
    const last = p[p.length - 1];
    const ma50 = mean(p.slice(-50));
    const sd50 = stdev(p.slice(-50));
    const back = (n: number) => (p.length > n ? last / p[p.length - 1 - n] - 1 : null);
    return { s, vol: annualVol(dailyReturns(cl)), z: (last - ma50) / sd50, m3: back(63), m12: back(Math.min(252, p.length - 1)), from: cl[0][0], to: cl[cl.length - 1][0] };
  });
  return (
    <>
      <h3 className="mt-8 font-serif text-lg font-semibold mb-2">4. Price signals: momentum and mean reversion</h3>
      {!rows.length ? <Note>Needs daily closing prices, which aren&apos;t loaded for these companies yet.</Note> : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r, i) => (
            <Panel key={r.s.c.cik} title={`${r.s.c.ticker} · ${r.from} to ${r.to}`}>
              <KV label="3-month return (momentum)" value={signedPct(r.m3)} tone={r.m3 != null && r.m3 > 0 ? "text-pos" : "text-neg"} />
              <KV label="Return over the history on file" value={signedPct(r.m12)} />
              <KV label="Annual volatility" value={pct(r.vol)} />
              <KV label="Distance from 50-day average (z-score)" value={`${r.z > 0 ? "+" : ""}${r.z.toFixed(2)}`} strong />
              <p className="mt-2 text-xs text-muted" style={{ color: SERIES[i] }}>{Math.abs(r.z) > 2 ? "More than 2 standard deviations from its recent average: unusually stretched." : "Within the normal range of its recent average."}</p>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
