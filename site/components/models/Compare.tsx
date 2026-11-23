"use client";
import { money, pct, signedPct, times, perShare } from "@/lib/format";
import { cagr, growthRates, isNum, latestYear, netDebt, type ModelCompany, type ModelYear } from "@/lib/models";
import { BarGroups, LineChart, SERIES } from "./charts";
import { Explainer, Note, ScrollTable } from "./parts";
import type { ModelProps, Side } from "./ModelLab";

/** Align one or two companies' annual figures on calendar fiscal-year labels. */
export function aligned(sides: ModelCompany[], f: (y: ModelYear) => number | null) {
  const years = [...new Set(sides.flatMap((c) => c.years.map((y) => y.end.slice(0, 4))))].sort();
  return {
    labels: years.map((y) => `FY${y}`),
    values: sides.map((c) => years.map((yr) => { const y = c.years.find((r) => r.end.startsWith(yr)); return y ? f(y) : null; })),
  };
}

export function metrics(s: Side) {
  const c = s.c, y = latestYear(c);
  const rg = growthRates(c.years.map((r) => r.revenue));
  const mcap = s.price != null && s.shares != null ? s.price * s.shares : null;
  const ev = mcap != null ? mcap + netDebt(c) : null;
  const r = (a: number | null | undefined, b: number | null | undefined) => (isNum(a) && isNum(b) && b !== 0 ? a / b : null);
  return {
    fy: y?.end ?? null,
    revenue: y?.revenue ?? null,
    revenueGrowth: rg.length ? rg[rg.length - 1] : null,
    revenueCagr: (() => { const g = cagr(c.years[0]?.revenue ?? null, y?.revenue ?? null, c.years.length - 1); return isNum(g) ? g : null; })(),
    operatingIncome: y?.operatingIncome ?? null,
    netIncome: y?.netIncome ?? null,
    opMargin: r(y?.operatingIncome, y?.revenue),
    netMargin: r(y?.netIncome, y?.revenue),
    roe: y?.equity && y.equity > 0 ? r(y?.netIncome, y?.equity) : null,
    equityToAssets: r(y?.equity, y?.assets),
    fcf: y?.fcf ?? null,
    fcfMargin: r(y?.fcf, y?.revenue),
    eps: y?.eps ?? null,
    netDebt: y ? netDebt(c) : null,
    mcap, ev,
    pe: s.price != null && isNum(y?.eps) && y.eps > 0 ? s.price / y.eps : null,
    pb: mcap != null && isNum(y?.equity) && y.equity > 0 ? mcap / y.equity : null,
    evRevenue: r(ev, y?.revenue),
    evEbit: isNum(y?.operatingIncome) && y.operatingIncome > 0 ? r(ev, y?.operatingIncome) : null,
    pFcf: mcap != null && isNum(y?.fcf) && y.fcf > 0 ? mcap / y.fcf : null,
  };
}

export default function Compare({ a, b }: ModelProps) {
  const sides = [a, b].filter(Boolean) as Side[];
  const cs = sides.map((s) => s.c);
  const names = cs.map((c) => c.ticker ?? c.name);
  const m = sides.map(metrics);
  const rev = aligned(cs, (y) => y.revenue);
  const ni = aligned(cs, (y) => y.netIncome);
  const margin = aligned(cs, (y) => (isNum(y.netIncome) && isNum(y.revenue) && y.revenue ? y.netIncome / y.revenue : null));
  const indexed = rev.values.map((vals) => { const base = vals.find((v) => isNum(v) && v > 0); return vals.map((v) => (isNum(v) && base ? (v / base) * 100 : null)); });

  const rows: [string, (x: ReturnType<typeof metrics>) => string, string?][] = [
    ["Latest fiscal year ends", (x) => x.fy ?? "—"],
    ["Revenue", (x) => money(x.revenue)],
    ["Revenue growth, latest year", (x) => signedPct(x.revenueGrowth)],
    ["Revenue growth per year, all years on file", (x) => signedPct(x.revenueCagr)],
    ["Operating income", (x) => money(x.operatingIncome)],
    ["Net income", (x) => money(x.netIncome)],
    ["Operating margin", (x) => pct(x.opMargin)],
    ["Net margin", (x) => pct(x.netMargin)],
    ["Return on equity", (x) => pct(x.roe)],
    ["Equity ÷ assets", (x) => pct(x.equityToAssets)],
    ["Free cash flow", (x) => money(x.fcf)],
    ["Free cash flow margin", (x) => pct(x.fcfMargin)],
    ["Diluted EPS", (x) => perShare(x.eps)],
    ["Net debt (long-term debt − cash)", (x) => money(x.netDebt)],
    ["Market value", (x) => money(x.mcap), "price"],
    ["Enterprise value", (x) => money(x.ev), "price"],
    ["Price ÷ earnings (P/E)", (x) => times(x.pe), "price"],
    ["Price ÷ book value (P/B)", (x) => times(x.pb), "price"],
    ["EV ÷ revenue", (x) => times(x.evRevenue), "price"],
    ["EV ÷ operating income", (x) => times(x.evEbit), "price"],
    ["Price ÷ free cash flow", (x) => times(x.pFcf), "price"],
  ];

  const priced = sides.filter((s) => s.c.closes && s.c.closes.length > 20);
  let priceChart = null;
  if (priced.length) {
    const dates = [...new Set(priced.flatMap((s) => s.c.closes!.map((d) => d[0])))].sort();
    const series = priced.map((s, i) => {
      const map = new Map(s.c.closes!);
      const base = s.c.closes![0][1];
      return { name: s.c.ticker ?? s.c.name, color: SERIES[sides.indexOf(s)] ?? SERIES[i], values: dates.map((d) => (map.has(d) ? (map.get(d)! / base) * 100 : null)) };
    });
    priceChart = <LineChart title="Share price, indexed to 100 at the start" labels={dates.map((d) => d.slice(2, 7))} series={series} format={(n) => n.toFixed(0)} />;
  }

  return (
    <div>
      <ScrollTable>
        <thead><tr className="border-b border-rule text-left text-xs uppercase tracking-wide text-muted">
          <th className="p-2 font-medium">Measure</th>
          {names.map((n, i) => <th key={n} className="p-2 font-medium text-right" style={{ color: SERIES[i] }}>{n}</th>)}
        </tr></thead>
        <tbody>
          {rows.map(([label, f, needs]) => (
            <tr key={label} className="border-b border-rule last:border-0">
              <td className="p-2 text-muted">{label}{needs && <span className="text-[10px] ml-1 align-super">needs price</span>}</td>
              {m.map((x, i) => <td key={i} className="p-2 text-right whitespace-nowrap">{f(x)}</td>)}
            </tr>
          ))}
        </tbody>
      </ScrollTable>
      {sides.some((s) => s.c.financial) && (
        <div className="mt-3"><Note tone="warn">Banks and insurers report differently: their &quot;revenue&quot; is mostly interest and fee income, debt is part of how they operate, and capital spending is rarely tagged. Compare them with P/B and return on equity rather than cash-flow measures.</Note></div>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <LineChart title="Revenue" labels={rev.labels} series={names.map((n, i) => ({ name: n, values: rev.values[i] }))} format={(v) => money(v, 0)} />
        <LineChart title="Revenue, indexed to 100 in first year on file" labels={rev.labels} series={names.map((n, i) => ({ name: n, values: indexed[i] }))} format={(v) => v.toFixed(0)} />
        <BarGroups title="Net income" labels={ni.labels} series={names.map((n, i) => ({ name: n, values: ni.values[i] }))} format={(v) => money(v, 0)} />
        <LineChart title="Net margin" labels={margin.labels} series={names.map((n, i) => ({ name: n, values: margin.values[i] }))} format={(v) => pct(v, 0)} />
      </div>
      {priceChart && <div className="mt-4">{priceChart}</div>}
      <Explainer
        does={<>Lines up two companies&apos; filed numbers side by side: size, growth, profitability, balance-sheet strength and cash generation. When you add a share price, it also works out market value and the common valuation ratios.</>}
        purpose={<>Numbers mean little alone. A 10% margin is excellent for a grocer and weak for a software company. Putting two businesses next to each other is the first step in almost every analyst&apos;s process.</>}
        uses={<>Spot which company is growing faster, which turns more revenue into profit, and which carries more debt. The indexed chart lets you compare growth even when one company is 50 times bigger.</>}
        limits={<>Uses the 2 to 5 annual reports on file for each company, as tagged in SEC data. Fiscal years can end in different months. Market value is price times an estimated share count, so check the share count against the 10-K cover page.</>}
      />
    </div>
  );
}
