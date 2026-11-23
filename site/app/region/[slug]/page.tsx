import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SortableTable, { type Column, type Row } from "@/components/SortableTable";
import { PageTitle, Section, SourceLink, Stat } from "@/components/ui";
import { AREAS, CENSUS, areaRecords, getArea, townsIn } from "@/lib/areas";
import { privateData } from "@/lib/data";
import { int, money, signedPct, tone } from "@/lib/format";

export const dynamicParams = false;
export function generateStaticParams() {
  return AREAS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const area = getArea((await params).slug);
  if (!area) return {};
  const where = `${area.name}, NC`;
  return {
    title: `${area.name} businesses, layoffs and contracts`,
    description: `Public companies, WARN layoff notices, federal contractors and large nonprofits in ${where}, from public records with every figure linked to its source.`,
  };
}

const companyCols: Column[] = [
  { key: "name", label: "Company", kind: "text" },
  { key: "city", label: "City", kind: "text" },
  { key: "revenue", label: "Annual revenue", kind: "money" },
  { key: "netIncome", label: "Net income", kind: "money", tone: true },
  { key: "quarter", label: "Latest qtr", kind: "text" },
  { key: "qGrowth", label: "Qtr rev. vs yr ago", kind: "signedPct", tone: true },
];
const warnCols: Column[] = [
  { key: "company", label: "Company", kind: "text" },
  { key: "city", label: "City", kind: "text" },
  { key: "type", label: "Type", kind: "text" },
  { key: "affected", label: "Workers", kind: "int" },
  { key: "noticeDate", label: "Notice", kind: "date" },
  { key: "effectiveDate", label: "Effective", kind: "date" },
];

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted rounded-md border border-dashed border-rule p-4">{children}</p>;
}

export default async function AreaPage({ params }: { params: Promise<{ slug: string }> }) {
  const area = getArea((await params).slug);
  if (!area) notFound();
  const { cos, nps, warn, contractors } = areaRecords(area);
  const { completed, prior } = privateData.fiscalYears;
  const year = privateData.warn.year;
  const isTown = area.kind === "town";
  const countyArea = AREAS.find((a) => a.kind === "county" && a.county === area.county)!;
  const towns = townsIn(area.county);
  const growth = area.census.pop2025 / area.census.base2020 - 1;
  const workers = warn.reduce((s, w) => s + w.affected, 0);
  const contractTotal = (contractors ?? []).reduce((s, c) => s + ((c[completed] as number) ?? 0), 0);
  const popSource = isTown ? CENSUS.cityFile : CENSUS.countyFile;

  const companyRows: Row[] = cos.map((c) => ({
    name: c.name, city: c.city, ticker: c.tickers[0] ?? null,
    revenue: c.years[0]?.revenue ?? null, netIncome: c.years[0]?.netIncome ?? null,
    quarter: c.latestQuarter?.label ?? null, qGrowth: c.latestQuarter?.revenueGrowth ?? null,
    href: `/companies/${c.cik}`,
  }));
  const warnRows: Row[] = warn.map((w) => ({ company: w.company, city: w.city, type: `${w.type} (${w.permanence.toLowerCase()})`, affected: w.affected, noticeDate: w.noticeDate, effectiveDate: w.effectiveDate }));

  return (
    <>
      <p className="text-sm mb-3"><Link href="/region" className="text-accent hover:underline">← Counties and towns</Link></p>
      <PageTitle kicker={isTown ? `Town in ${area.county} County, NC` : "County, North Carolina"} title={area.name}>
        <p>
          {area.blurb}{" "}
          {isTown
            ? <>Records are matched by the city in each organization’s filed address, which can include addresses just outside town limits. The county-wide view is on the <Link href={`/region/${countyArea.slug}`} className="underline">{countyArea.name}</Link> page.</>
            : <>Records are assigned to a county by ZIP code (<Link href="/methodology" className="underline">how</Link>).</>}
        </p>
      </PageTitle>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
        <Stat label={`Population, ${CENSUS.asOf}`} value={int(area.census.pop2025)} sub={`${signedPct(growth)} vs 2020 base (${int(area.census.base2020)})`} />
        <Stat label="SEC-registered companies HQ’d here" value={int(cos.length)} />
        <Stat label={`Layoff notices, ${year}`} value={int(warn.length)} sub={warn.length ? `${int(workers)} workers affected` : undefined} />
        <Stat label={`Federal contracts, ${completed}`} value={contractors ? money(contractTotal) : "—"} sub={contractors ? `Top ${contractors.length} recipients` : isTown ? "Tracked by county only" : "Not yet collected"} />
      </div>
      <p className="text-xs text-muted mb-4">
        Population: U.S. Census Bureau, {CENSUS.vintage} estimates for {area.census.name}, July 1, 2025, against the
        April 1, 2020 estimates base (<SourceLink href={popSource}>source file</SourceLink>).
      </p>

      {!isTown && towns.length > 0 && (
        <p className="text-sm mb-4">Towns: {towns.map((t, i) => <span key={t.slug}>{i > 0 && " · "}<Link href={`/region/${t.slug}`} className="text-accent hover:underline">{t.name}</Link></span>)}</p>
      )}

      <Section title="Public companies headquartered here" href="/companies" linkLabel="All NC companies">
        {companyRows.length
          ? <SortableTable columns={companyCols} rows={companyRows} searchKeys={["name", "city", "ticker"]} initialSort="revenue" placeholder="Search company or city" />
          : <Empty>No SEC-registered public company lists its headquarters in {area.name}. Private companies don’t file public financials, and this site doesn’t estimate them.</Empty>}
        <p className="text-xs text-muted mt-2">Source: each company’s SEC filings, linked on its profile.</p>
      </Section>

      <Section title={`Layoff and closure notices, ${year}`} href="/layoffs" linkLabel="All NC layoffs">
        {warnRows.length
          ? <SortableTable columns={warnCols} rows={warnRows} searchKeys={["company", "city"]} initialSort="noticeDate" placeholder="Search company or city" />
          : <Empty>No WARN notices {isTown ? `list ${area.name} as the city` : `in ${area.name}`} so far in {year}.</Empty>}
        <p className="text-xs text-muted mt-2">Employers with 100+ workers must file a WARN notice; North Carolina publishes every notice it receives, including smaller ones. Source: <SourceLink href={privateData.warn.sourcePage}>NC Department of Commerce</SourceLink> (<SourceLink href={privateData.warn.sourceCsv}>data file</SourceLink>).</p>
      </Section>

      <Section title={`Federal contractors, ${completed}`} href="/contracts" linkLabel="Statewide">
        {contractors?.length ? (
          <div className="overflow-x-auto rounded-md border border-rule bg-card">
            <table className="w-full text-sm num">
              <thead>
                <tr className="border-b border-rule text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-3 py-2 text-left font-medium">Contractor</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{completed}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">vs {prior}</th>
                </tr>
              </thead>
              <tbody>
                {contractors.map((c) => (
                  <tr key={c.recipientId} className="border-b border-rule last:border-0">
                    <td className="px-3 py-2"><a href={c.source} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-accent">{c.name}</a></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{money(c[completed] as number)}</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${tone(c.growth)}`}>{c[prior] == null ? "new" : signedPct(c.growth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : isTown ? (
          <Empty>Federal contract data is grouped by county. See the <Link href={`/region/${countyArea.slug}`} className="underline">{countyArea.name}</Link> page.</Empty>
        ) : (
          <Empty>This site doesn’t collect contractor data for {area.name} yet. Search it directly on <SourceLink href="https://www.usaspending.gov/search">USAspending.gov</SourceLink>.</Empty>
        )}
        <p className="text-xs text-muted mt-2">Contract obligations to recipients with an address in the county. Source: <SourceLink href="https://www.usaspending.gov/">USAspending.gov</SourceLink>.</p>
      </Section>

      <Section title="Large nonprofits based here" href="/nonprofits" linkLabel="Statewide">
        {nps.length ? (
          <div className="overflow-x-auto rounded-md border border-rule bg-card">
            <table className="w-full text-sm num">
              <thead>
                <tr className="border-b border-rule text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-3 py-2 text-left font-medium">Organization</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">City</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Revenue</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Surplus / deficit</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Tax year</th>
                </tr>
              </thead>
              <tbody>
                {nps.map((n) => (
                  <tr key={n.ein} className="border-b border-rule last:border-0">
                    <td className="px-3 py-2"><Link href={`/nonprofits/${n.ein}`} className="font-medium hover:text-accent">{n.name}</Link></td>
                    <td className="px-3 py-2 text-muted">{n.city}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{money(n.filings[0]?.revenue ?? n.irsBmf.revenue)}</td>
                    <td className={`px-3 py-2 text-right whitespace-nowrap ${tone(n.derived?.surplus)}`}>{money(n.derived?.surplus)}</td>
                    <td className="px-3 py-2 text-right">{n.filings[0]?.taxYear ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>None of the nonprofits this site tracks (the 100 largest statewide and the 25 largest in the region) is based in {area.name}.</Empty>
        )}
        <p className="text-xs text-muted mt-2">Figures from each organization’s latest Form 990 via ProPublica Nonprofit Explorer, linked on its profile.</p>
      </Section>
    </>
  );
}
