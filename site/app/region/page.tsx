import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle, Section, SourceLink } from "@/components/ui";
import { AREAS, CENSUS, areaRecords, townsIn } from "@/lib/areas";
import { int } from "@/lib/format";

export const metadata: Metadata = {
  title: "Counties and towns",
  description: "Public companies, layoff notices, federal contractors and nonprofits for Mecklenburg, Union, Cabarrus, Gaston and Iredell counties and the towns of Concord, Gastonia, Mooresville, Huntersville and Matthews.",
};

export default function RegionIndex() {
  const counties = AREAS.filter((a) => a.kind === "county");
  return (
    <>
      <PageTitle kicker="Charlotte region" title="Counties and towns">
        <p>
          One page per county and town, each built only from the public records this site already tracks. Population
          figures are U.S. Census Bureau estimates for {CENSUS.asOf}. For the full eight-county view, see the{" "}
          <Link href="/charlotte" className="underline">Charlotte region</Link> page.
        </p>
      </PageTitle>
      <Section title="Counties and their towns">
        <div className="overflow-x-auto rounded-md border border-rule bg-card">
          <table className="w-full text-sm num">
            <thead>
              <tr className="border-b border-rule text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-3 py-2 text-left font-medium">Area</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Population, 2025</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Public cos.</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Layoff notices</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Large nonprofits</th>
              </tr>
            </thead>
            <tbody>
              {counties.flatMap((c) => [c, ...townsIn(c.county)]).map((a) => {
                const r = areaRecords(a);
                return (
                  <tr key={a.slug} className="border-b border-rule last:border-0">
                    <td className={`px-3 py-2 ${a.kind === "town" ? "pl-8" : ""}`}>
                      <Link href={`/region/${a.slug}`} className="font-medium hover:text-accent">{a.name}</Link>
                      {a.kind === "town" && <span className="text-xs text-muted"> · town</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{int(a.census.pop2025)}</td>
                    <td className="px-3 py-2 text-right">{int(r.cos.length)}</td>
                    <td className="px-3 py-2 text-right">{int(r.warn.length)}</td>
                    <td className="px-3 py-2 text-right">{int(r.nps.length)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-2">
          Counts are records in this site’s data: SEC-registered companies headquartered there,
          WARN notices filed this year, and nonprofits among the largest tracked statewide or in the region. Towns are
          matched by the city in each record’s filed address. Population: <SourceLink href={CENSUS.countyFile}>Census county estimates</SourceLink>,{" "}
          <SourceLink href={CENSUS.cityFile}>Census city and town estimates</SourceLink> ({CENSUS.vintage}).
        </p>
      </Section>
    </>
  );
}
