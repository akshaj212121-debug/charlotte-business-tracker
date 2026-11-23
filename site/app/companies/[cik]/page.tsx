import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BarChart from "@/components/BarChart";
import { Badge, PageTitle, Section, SourceLink, Stat } from "@/components/ui";
import { companies, getCompany, type Company } from "@/lib/data";
import { date, money, pct, perShare, signedPct, times, tone } from "@/lib/format";

export function generateStaticParams() {
  return companies.map((c) => ({ cik: String(c.cik) }));
}

export async function generateMetadata({ params }: { params: Promise<{ cik: string }> }): Promise<Metadata> {
  const c = getCompany((await params).cik);
  return c ? { title: `${c.name} financials`, description: `${c.name} (${c.tickers.join(", ") || "SEC filer"}), ${c.city}, NC: revenue, profit, balance sheet and recent SEC filings.` } : {};
}

// One factual sentence built only from filed numbers. No adjectives the data can't support.
function snapshot(c: Company): string | null {
  const [cur, prev] = c.years;
  if (!cur || cur.revenue == null) return null;
  const fy = cur.end.slice(0, 4);
  let s = `In fiscal ${fy}, ${c.name} reported revenue of ${money(cur.revenue)}`;
  if (prev?.revenue) s += `, ${cur.revenue >= prev.revenue ? "up" : "down"} ${pct(Math.abs((cur.revenue - prev.revenue) / prev.revenue))} from the prior year`;
  if (cur.netIncome != null) s += `, and ${cur.netIncome >= 0 ? "net income" : "a net loss"} of ${money(Math.abs(cur.netIncome))}`;
  return `${s}.`;
}

const ROWS: { key: keyof Company["years"][number]; label: string; fmt: (n: number | null) => string }[] = [
  { key: "revenue", label: "Revenue", fmt: money },
  { key: "operatingIncome", label: "Operating income", fmt: money },
  { key: "netIncome", label: "Net income", fmt: money },
  { key: "epsDiluted", label: "Diluted EPS", fmt: perShare },
  { key: "dividendsPerShare", label: "Dividends / share", fmt: perShare },
  { key: "operatingCashFlow", label: "Operating cash flow", fmt: money },
  { key: "capex", label: "Capital expenditures", fmt: money },
  { key: "freeCashFlow", label: "Free cash flow (calc.)", fmt: money },
  { key: "cash", label: "Cash & equivalents", fmt: money },
  { key: "assets", label: "Total assets", fmt: money },
  { key: "liabilities", label: "Total liabilities", fmt: money },
  { key: "longTermDebt", label: "Long-term debt", fmt: money },
  { key: "equity", label: "Shareholders’ equity", fmt: money },
];

export default async function CompanyPage({ params }: { params: Promise<{ cik: string }> }) {
  const c = getCompany((await params).cik);
  if (!c) notFound();
  const cur = c.years[0];
  const d = c.derived;
  const q = c.latestQuarter;
  const sentence = snapshot(c);

  return (
    <article>
      <PageTitle kicker={[c.tickers[0], [...new Set(c.exchanges.filter(Boolean))].join(", ")].filter(Boolean).join(" · ") || "SEC registrant"} title={c.name}>
        <p>{c.industry || "Industry not classified"} · {c.city}, NC{c.county ? ` (${c.county} County)` : ""}{c.fiscalYearEnd ? ` · Fiscal year ends ${c.fiscalYearEnd.slice(0, 2)}/${c.fiscalYearEnd.slice(2)}` : ""}{c.filerCategory ? ` · ${c.filerCategory}` : ""}</p>
        {c.formerNames.length > 0 && <p className="text-sm mt-1">Formerly: {c.formerNames.slice(0, 3).join("; ")}</p>}
        {c.years.length >= 2 && <p className="text-sm mt-2"><a href={`/models?a=${c.tickers[0] ?? c.cik}&b=none&model=dcf`} className="text-accent underline">Run valuation models on {c.name} →</a></p>}
      </PageTitle>

      {sentence && <p className="text-lg leading-relaxed max-w-3xl -mt-2 mb-8">{sentence}</p>}

      {c.pendingReport && (
        <p className="rounded-md border border-rule bg-warn-soft p-3 text-sm mb-6">
          {c.name} filed a {c.pendingReport.form} for the period ended {date(c.pendingReport.reportDate)} on {date(c.pendingReport.filed)}, but
          the SEC’s structured-data feed doesn’t include its figures yet, so the numbers below stop earlier. <SourceLink href={c.pendingReport.url}>Read the filing</SourceLink>.
        </p>
      )}

      {q && (
        <section className="mb-8" aria-labelledby="latest-quarter">
          <h2 id="latest-quarter" className="text-xs uppercase tracking-wide text-muted font-medium mb-2">
            Latest quarter: {q.label}, ended {date(q.end)} · filed {date(q.filed)} · <SourceLink href={q.url}>{q.form}</SourceLink>
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Stat label="Quarterly revenue" value={money(q.revenue)} sub={q.prior ? `${signedPct(q.revenueGrowth)} vs ${money(q.prior.revenue)} a year earlier` : "No year-ago quarter in the data"} />
            <Stat label="Quarterly net income" value={money(q.netIncome)} sub={q.prior ? `${signedPct(q.netIncomeGrowth)} vs ${money(q.prior.netIncome)} a year earlier` : undefined} toneClass={tone(q.netIncome)} />
            <Stat label="Diluted EPS" value={perShare(q.epsDiluted)} sub={q.prior?.epsDiluted != null ? `${perShare(q.prior.epsDiluted)} a year earlier` : undefined} />
          </div>
          {q.revenueCalc && <p className="text-xs text-muted mt-1">Quarterly revenue calculated as net interest income plus noninterest income.</p>}
        </section>
      )}

      {cur ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Revenue" value={money(cur.revenue)} sub={`FY ${cur.end.slice(0, 4)} · ${signedPct(d?.revenueGrowth)} YoY`} />
            <Stat label="Net income" value={money(cur.netIncome)} sub={`Margin ${pct(d?.netMargin)}`} toneClass={tone(cur.netIncome)} />
            <Stat label="Operating margin" value={pct(d?.operatingMargin)} sub={`Operating income ${money(cur.operatingIncome)}`} />
            <Stat label="Free cash flow" value={money(cur.freeCashFlow)} sub={`FCF margin ${pct(d?.fcfMargin)}`} toneClass={tone(cur.freeCashFlow)} />
            <Stat label="Return on equity" value={pct(d?.returnOnEquity)} sub="Net income ÷ equity" />
            <Stat label="Return on assets" value={pct(d?.returnOnAssets)} sub="Net income ÷ assets" />
            <Stat label="Liabilities / equity" value={times(d?.liabilitiesToEquity)} sub="Balance-sheet leverage" />
            <Stat label="Cash" value={money(cur.cash)} sub={`Long-term debt ${money(cur.longTermDebt)}`} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            <BarChart title="Revenue" points={c.years.map((y) => ({ label: y.end.slice(0, 4), value: y.revenue }))} />
            <BarChart title="Net income" points={c.years.map((y) => ({ label: y.end.slice(0, 4), value: y.netIncome }))} />
          </div>

          <Section title="Five-year financials">
            <div className="overflow-x-auto rounded-md border border-rule bg-card">
              <table className="w-full text-sm num">
                <thead>
                  <tr className="border-b border-rule text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="px-3 py-2 text-left font-medium">Fiscal year ending</th>
                    {c.years.map((y) => <th key={y.end} scope="col" className="px-3 py-2 text-right font-medium whitespace-nowrap">{date(y.end)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.filter((r) => c.years.some((y) => y[r.key] != null)).map((r) => (
                    <tr key={r.key} className="border-b border-rule last:border-0">
                      <th scope="row" className="px-3 py-2 text-left font-normal whitespace-nowrap">{r.label}</th>
                      {c.years.map((y) => <td key={y.end} className="px-3 py-2 text-right whitespace-nowrap">{r.fmt(y[r.key] as number | null)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted mt-2">Annual figures from 10-K XBRL data; later filings’ restated figures replace originals. Ratios and free cash flow are calculated by this site from the filed figures.</p>
            {c.years.some((y) => y.revenueCalc) && (
              <p className="text-xs text-muted mt-1">Revenue for this bank is calculated as net interest income plus noninterest income, the industry-standard total, because the filing does not tag a single revenue line.</p>
            )}
          </Section>
        </>
      ) : (
        <p className="rounded-md border border-rule bg-card p-4 text-muted">This registrant files with the SEC but has no annual financial statements in structured (XBRL) form. See its filings below.</p>
      )}

      {c.signals.length > 0 && (
        <Section title="Distress signals (last 180 days)">
          <ul className="space-y-2">
            {c.signals.map((f) => (
              <li key={f.url} className="rounded-md border border-rule bg-warn-soft p-3 text-sm">
                <span className="font-medium">{date(f.date)} · {f.form}</span> — {f.items.map((i) => i.label).join("; ")}. <SourceLink href={f.url}>Read filing</SourceLink>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Recent SEC filings">
        {c.filings.length === 0 ? <p className="text-muted text-sm">No 10-K, 10-Q, 8-K or proxy filings in the last 180 days.</p> : (
          <ul className="divide-y divide-rule rounded-md border border-rule bg-card">
            {c.filings.slice(0, 15).map((f) => (
              <li key={f.url} className="px-3 py-2 text-sm flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="num text-muted w-28 shrink-0">{date(f.date)}</span>
                <span className="font-medium w-16 shrink-0">{f.form}</span>
                <span className="flex-1 min-w-0">{f.items.length ? f.items.map((i) => i.label).join("; ") : ""} {f.distress && <Badge tone="warn">Signal</Badge>}</span>
                <SourceLink href={f.url}>View</SourceLink>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Sources">
        <ul className="text-sm space-y-1">
          <li><SourceLink href={c.sources.filings}>All SEC EDGAR filings for {c.name}</SourceLink></li>
          <li><SourceLink href={c.sources.xbrl}>Structured financial data (XBRL company facts, JSON)</SourceLink></li>
          <li className="text-muted">Legal name: {c.legalName} · SEC Central Index Key (CIK): {c.cik}{c.tickers.length > 1 ? ` · Other listed securities: ${c.tickers.slice(1).join(", ")}` : ""}</li>
        </ul>
      </Section>
    </article>
  );
}
