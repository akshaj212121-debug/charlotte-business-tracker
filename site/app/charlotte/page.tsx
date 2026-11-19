import type { Metadata } from "next";
import Link from "next/link";
import SortableTable, { type Column, type Row } from "@/components/SortableTable";
import { PageTitle, Section, SourceLink, Stat } from "@/components/ui";
import { companies, CORE_COUNTIES, inRegion, nonprofits, privateData, REGION_COUNTIES, warnNotices, type Contractor } from "@/lib/data";
import { int, money, signedPct, tone } from "@/lib/format";

export const metadata: Metadata = { title: "Charlotte region", description: "Public companies, layoffs, federal contracts and nonprofits in Mecklenburg, Union and the surrounding Charlotte-region counties." };

const companyCols: Column[] = [
  { key: "name", label: "Company", kind: "text" },
  { key: "county", label: "County", kind: "text" },
  { key: "revenue", label: "Annual revenue", kind: "money" },
  { key: "netIncome", label: "Net income", kind: "money", tone: true },
  { key: "quarter", label: "Latest qtr", kind: "text" },
  { key: "qGrowth", label: "Qtr rev. vs yr ago", kind: "signedPct", tone: true },
];
const warnCols: Column[] = [
  { key: "company", label: "Company", kind: "text" },
  { key: "county", label: "County", kind: "text" },
  { key: "city", label: "City", kind: "text" },
  { key: "type", label: "Type", kind: "text" },
  { key: "affected", label: "Workers", kind: "int" },
  { key: "noticeDate", label: "Notice", kind: "date" },
  { key: "effectiveDate", label: "Effective", kind: "date" },
];

function ContractorTable({ county, rows, fy, prior }: { county: string; rows: Contractor[]; fy: string; prior: string }) {
  return (
    <div>
      <h3 className="font-medium mb-2">{county} County</h3>
      <div className="overflow-x-auto rounded-md border border-rule bg-card">
        <table className="w-full text-sm num">
          <thead>
            <tr className="border-b border-rule text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-3 py-2 text-left font-medium">Contractor</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{fy}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">vs {prior}</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((c) => (
              <tr key={c.recipientId} className="border-b border-rule last:border-0">
                <td className="px-3 py-2"><a href={c.source} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-accent">{c.name}</a></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{money(c[fy] as number)}</td>
                <td className={`px-3 py-2 text-right whitespace-nowrap ${tone(c.growth)}`}>{c[prior] == null ? "new" : signedPct(c.growth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CharlottePage() {
  const local = companies.filter((c) => inRegion(c.county));
  const core = local.filter((c) => CORE_COUNTIES.includes(c.county!));
  const coreRevenue = core.reduce((s, c) => s + (c.years[0]?.revenue ?? 0), 0);
  const warn = warnNotices.filter((w) => REGION_COUNTIES.includes(w.county));
  const warnCore = warn.filter((w) => CORE_COUNTIES.includes(w.county));
  const { completed, prior } = privateData.fiscalYears;
  const lc = privateData.localContractors;
  const contractTotal = CORE_COUNTIES.reduce((s, k) => s + (lc[k] ?? []).reduce((t, c) => t + ((c[completed] as number) ?? 0), 0), 0);
  const regionalNp = nonprofits.filter((n) => n.rankRegion != null).sort((a, b) => a.rankRegion! - b.rankRegion!);

  const companyRows: Row[] = local.map((c) => ({
    name: c.name, county: c.county, city: c.city, ticker: c.tickers[0] ?? null,
    revenue: c.years[0]?.revenue ?? null, netIncome: c.years[0]?.netIncome ?? null,
    quarter: c.latestQuarter?.label ?? null, qGrowth: c.latestQuarter?.revenueGrowth ?? null,
    href: `/companies/${c.cik}`,
  }));
  const warnRows: Row[] = warn.map((w) => ({ company: w.company, county: w.county, city: w.city, type: w.type, affected: w.affected, noticeDate: w.noticeDate, effectiveDate: w.effectiveDate }));

  return (
    <>
      <PageTitle kicker="Mecklenburg · Union · surrounding counties" title="The Charlotte region">
        <p>
          Mecklenburg and Union counties first, then the six other North Carolina counties in the Charlotte–Concord–Gastonia
          metro area ({REGION_COUNTIES.slice(2).join(", ")}), as defined by the federal Office of Management and Budget.
          Counties come from each organization’s ZIP code (<Link href="/methodology" className="underline">how</Link>).
        </p>
      </PageTitle>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat label="Public companies, Meck + Union" value={int(core.length)} sub={`${int(local.length)} in the 8-county region`} />
        <Stat label="Their combined revenue" value={money(coreRevenue)} sub="Latest fiscal years" />
        <Stat label={`Layoff notices ${privateData.warn.year}, Meck + Union`} value={int(warnCore.length)} sub={`${int(warnCore.reduce((s, w) => s + w.affected, 0))} workers · region ${int(warn.reduce((s, w) => s + w.affected, 0))}`} />
        <Stat label={`Federal contracts ${completed}`} value={money(contractTotal)} sub="Top 25 recipients each in Meck + Union" />
      </div>

      <Section title="Public companies headquartered in the region" href="/companies" linkLabel="All NC companies">
        <SortableTable columns={companyCols} rows={companyRows} searchKeys={["name", "county", "city", "ticker"]} initialSort="revenue" placeholder="Search company, county or city" />
      </Section>

      <Section title={`Layoff and closure notices, ${privateData.warn.year}`} href="/layoffs" linkLabel="Statewide">
        {warnRows.length ? <SortableTable columns={warnCols} rows={warnRows} searchKeys={["company", "county", "city"]} initialSort="noticeDate" placeholder="Search company, county or city" /> : <p className="text-sm text-muted">No notices in the region this year.</p>}
      </Section>

      <Section title={`Federal contractors, ${completed}`} href="/contracts" linkLabel="Statewide">
        <div className="grid lg:grid-cols-2 gap-6">
          {CORE_COUNTIES.map((k) => <ContractorTable key={k} county={k} rows={lc[k] ?? []} fy={completed} prior={prior} />)}
        </div>
        <p className="text-xs text-muted mt-2">Contract obligations to recipients with an address in each county. “New” means the recipient was not among that county’s top 100 the year before. Source: <SourceLink href="https://www.usaspending.gov/">USAspending.gov</SourceLink>.</p>
      </Section>

      <Section title="Largest nonprofits in the region" href="/nonprofits" linkLabel="Statewide">
        <div className="overflow-x-auto rounded-md border border-rule bg-card">
          <table className="w-full text-sm num">
            <thead>
              <tr className="border-b border-rule text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-3 py-2 text-left font-medium">Organization</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">County</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Revenue</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Surplus / deficit</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Tax year</th>
              </tr>
            </thead>
            <tbody>
              {regionalNp.map((n) => (
                <tr key={n.ein} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2"><Link href={`/nonprofits/${n.ein}`} className="font-medium hover:text-accent">{n.name}</Link></td>
                  <td className="px-3 py-2 text-muted">{n.county}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{money(n.filings[0]?.revenue ?? n.irsBmf.revenue)}</td>
                  <td className={`px-3 py-2 text-right whitespace-nowrap ${tone(n.derived?.surplus)}`}>{money(n.derived?.surplus)}</td>
                  <td className="px-3 py-2 text-right">{n.filings[0]?.taxYear ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-2">The 25 largest exempt organizations in the 8 counties, ranked by the revenue each reports in the IRS Exempt Organizations Business Master File. Figures shown are from the latest Form 990.</p>
      </Section>
    </>
  );
}
