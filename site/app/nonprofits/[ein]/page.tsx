import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BarChart from "@/components/BarChart";
import { PageTitle, Section, SourceLink, Stat } from "@/components/ui";
import { getNonprofit, nonprofits, type NonprofitFiling } from "@/lib/data";
import { money, pct, signedPct, tone } from "@/lib/format";

export function generateStaticParams() {
  return nonprofits.map((n) => ({ ein: n.ein }));
}

export async function generateMetadata({ params }: { params: Promise<{ ein: string }> }): Promise<Metadata> {
  const n = getNonprofit((await params).ein);
  return n ? { title: `${n.name} finances`, description: `${n.name}, ${n.city}, NC: revenue, expenses, assets and Form 990 history.` } : {};
}

const ROWS: { key: keyof NonprofitFiling; label: string }[] = [
  { key: "revenue", label: "Total revenue" },
  { key: "programRevenue", label: "Program service revenue" },
  { key: "contributions", label: "Contributions & grants" },
  { key: "investmentIncome", label: "Investment income" },
  { key: "expenses", label: "Total functional expenses" },
  { key: "officerCompensation", label: "Compensation of current officers" },
  { key: "assets", label: "Total assets (end of year)" },
  { key: "liabilities", label: "Total liabilities (end of year)" },
  { key: "netAssets", label: "Net assets (end of year)" },
];

export default async function NonprofitPage({ params }: { params: Promise<{ ein: string }> }) {
  const n = getNonprofit((await params).ein);
  if (!n) notFound();
  const cur = n.filings[0];
  const d = n.derived;
  const ein = `${n.ein.slice(0, 2)}-${n.ein.slice(2)}`;

  return (
    <article>
      <PageTitle kicker={`${n.taxStatus} · EIN ${ein}`} title={n.name}>
        <p>{n.sector}{n.nteeCode ? ` (NTEE ${n.nteeCode})` : ""} · {n.city}, NC{n.rulingYear ? ` · Tax-exempt since ${n.rulingYear}` : ""}</p>
      </PageTitle>

      {cur ? (
        <>
          <p className="text-lg leading-relaxed max-w-3xl -mt-2 mb-8">
            On its {cur.taxYear} Form {cur.form}, {n.name} reported revenue of {money(cur.revenue)}
            {cur.expenses != null && ` against expenses of ${money(cur.expenses)}, ${cur.revenue - cur.expenses >= 0 ? "a surplus" : "a deficit"} of ${money(Math.abs(cur.revenue - cur.expenses))}`}.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Revenue" value={money(cur.revenue)} sub={`Tax year ${cur.taxYear} · ${signedPct(d?.revenueGrowth)} YoY`} />
            <Stat label="Surplus / deficit" value={money(d?.surplus)} sub={`Margin ${pct(d?.surplusMargin)}`} toneClass={tone(d?.surplus)} />
            <Stat label="Total assets" value={money(cur.assets)} sub={`Net assets ${money(cur.netAssets)}`} />
            <Stat label="Liabilities / assets" value={pct(d?.liabilitiesToAssets)} sub={`Contributions ${pct(d?.contributionShare)} of revenue`} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-6">
            <BarChart title="Revenue" points={n.filings.map((f) => ({ label: String(f.taxYear), value: f.revenue }))} />
            <BarChart title="Surplus / deficit" points={n.filings.map((f) => ({ label: String(f.taxYear), value: f.expenses != null ? f.revenue - f.expenses : null }))} />
          </div>
          <Section title="Form 990 history">
            <div className="overflow-x-auto rounded-md border border-rule bg-card">
              <table className="w-full text-sm num">
                <thead>
                  <tr className="border-b border-rule text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="px-3 py-2 text-left font-medium">Tax year</th>
                    {n.filings.map((f) => <th key={f.periodEnd} scope="col" className="px-3 py-2 text-right font-medium">{f.taxYear}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.filter((r) => n.filings.some((f) => f[r.key] != null)).map((r) => (
                    <tr key={r.key} className="border-b border-rule last:border-0">
                      <th scope="row" className="px-3 py-2 text-left font-normal whitespace-nowrap">{r.label}</th>
                      {n.filings.map((f) => <td key={f.periodEnd} className="px-3 py-2 text-right whitespace-nowrap">{money(f[r.key] as number | null)}</td>)}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row" className="px-3 py-2 text-left font-normal">Original filing</th>
                    {n.filings.map((f) => <td key={f.periodEnd} className="px-3 py-2 text-right">{f.pdf ? <SourceLink href={f.pdf}>PDF</SourceLink> : "—"}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>
        </>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Stat label="Revenue (IRS master file)" value={money(n.irsBmf.revenue)} sub={`Tax period ${n.irsBmf.taxPeriod}`} />
          <Stat label="Assets (IRS master file)" value={money(n.irsBmf.assets)} />
          <p className="col-span-full text-sm text-muted">No machine-readable 990 history is available for this organization yet.</p>
        </div>
      )}

      <Section title="Sources">
        <ul className="text-sm space-y-1">
          <li><SourceLink href={n.sources.propublica}>Form 990 filings on ProPublica Nonprofit Explorer</SourceLink></li>
          <li><SourceLink href={n.sources.irsBmf}>IRS Exempt Organizations Business Master File</SourceLink></li>
        </ul>
      </Section>
    </article>
  );
}
