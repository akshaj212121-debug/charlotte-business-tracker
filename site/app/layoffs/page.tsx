import type { Metadata } from "next";
import SortableTable, { type Column, type Row } from "@/components/SortableTable";
import { PageTitle, Section, SourceLink, Stat } from "@/components/ui";
import { privateData, warnNotices } from "@/lib/data";
import { int } from "@/lib/format";

export const metadata: Metadata = { title: "Layoffs & closures", description: "North Carolina WARN Act layoff and closure notices." };

const columns: Column[] = [
  { key: "company", label: "Company", kind: "text" },
  { key: "county", label: "County", kind: "text" },
  { key: "city", label: "City", kind: "text" },
  { key: "type", label: "Type", kind: "text" },
  { key: "affected", label: "Workers", kind: "int" },
  { key: "noticeDate", label: "Notice", kind: "date" },
  { key: "effectiveDate", label: "Effective", kind: "date" },
];

export default function LayoffsPage() {
  const { year, totals, sourcePage } = privateData.warn;
  const byCounty = Object.entries(warnNotices.reduce<Record<string, number>>((acc, w) => ({ ...acc, [w.county]: (acc[w.county] ?? 0) + w.affected }), {}))
    .sort((a, b) => b[1] - a[1]);
  const closures = warnNotices.filter((w) => /closure/i.test(w.type)).length;
  const rows: Row[] = warnNotices.map((w) => ({ company: w.company, county: w.county, city: w.city, type: `${w.type} (${w.permanence.toLowerCase()})`, affected: w.affected, noticeDate: w.noticeDate, effectiveDate: w.effectiveDate }));

  return (
    <>
      <PageTitle kicker="WARN Act notices" title={`North Carolina layoffs and closures, ${year}`}>
        Employers with 100+ workers must give 60 days’ notice before a plant closing or mass layoff. North Carolina
        publishes every notice it receives. This is one of the earliest public signals that a business is cutting back.
        Source: <SourceLink href={sourcePage}>NC Department of Commerce</SourceLink>.
      </PageTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="Notices filed" value={int(totals.notices)} sub={`${year} to date`} />
        <Stat label="Workers affected" value={int(totals.workersAffected)} />
        <Stat label="Closures" value={int(closures)} sub={`${int(totals.notices - closures)} layoffs`} />
        <Stat label="Most affected county" value={byCounty[0]?.[0] ?? "—"} sub={byCounty[0] ? `${int(byCounty[0][1])} workers` : undefined} />
      </div>
      <SortableTable columns={columns} rows={rows} searchKeys={["company", "county", "city"]} initialSort="noticeDate" placeholder="Search company, county or city" />
      <Section title="Workers affected by county">
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 text-sm">
          {byCounty.map(([county, n]) => (
            <li key={county} className="flex justify-between border-b border-rule py-1.5"><span>{county}</span><span className="num">{int(n)}</span></li>
          ))}
        </ul>
      </Section>
    </>
  );
}
