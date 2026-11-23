import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountyHelp, StatewideHelp } from "@/components/JobHelp";
import { PageTitle, Section, SourceLink, Stat } from "@/components/ui";
import { REGION_COUNTIES, privateData, warnNotices } from "@/lib/data";
import { date, int } from "@/lib/format";
import { countyFromSlug, countySlug } from "@/lib/jobHelp";

export function generateStaticParams() {
  return REGION_COUNTIES.map((c) => ({ county: countySlug(c) }));
}

export async function generateMetadata({ params }: { params: Promise<{ county: string }> }): Promise<Metadata> {
  const county = countyFromSlug((await params).county);
  return county
    ? { title: `${county} County layoffs and job help`, description: `WARN Act layoff and closure notices in ${county} County, NC, with links to unemployment, Rapid Response and NCWorks job help.` }
    : {};
}

export default async function CountyLayoffsPage({ params }: { params: Promise<{ county: string }> }) {
  const county = countyFromSlug((await params).county);
  if (!county) notFound();
  const { year, sourcePage } = privateData.warn;
  const notices = warnNotices.filter((w) => w.county === county);
  const workers = notices.reduce((s, w) => s + w.affected, 0);

  return (
    <>
      <PageTitle kicker={`Layoffs · ${county} County`} title={`${county} County layoffs and job help, ${year}`}>
        WARN Act notices filed with North Carolina for employers in {county} County, and where affected workers can get help.
        Source: <SourceLink href={sourcePage}>NC Department of Commerce WARN reports</SourceLink>.{" "}
        <Link href="/layoffs" className="text-accent hover:underline">See all North Carolina notices</Link>.
      </PageTitle>

      <div className="grid grid-cols-2 gap-3 mb-8 max-w-md">
        <Stat label="Notices filed" value={int(notices.length)} sub={`${year} to date`} />
        <Stat label="Workers affected" value={int(workers)} sub="as stated in notices" />
      </div>

      <Section title="If you were laid off: start here">
        <StatewideHelp />
      </Section>

      <Section title={`Career centers serving ${county} County`}>
        <CountyHelp county={county} />
      </Section>

      <Section title={`WARN notices in ${county} County, ${year}`}>
        {notices.length === 0 ? (
          <p className="text-sm text-muted">No WARN notices for {county} County in the state&apos;s {year} report so far.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-rule">
                  <th className="py-2 pr-4 font-medium">Company</th>
                  <th className="py-2 pr-4 font-medium">City</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium text-right">Workers</th>
                  <th className="py-2 pr-4 font-medium">Notice</th>
                  <th className="py-2 font-medium">Effective</th>
                </tr>
              </thead>
              <tbody>
                {notices.map((w) => (
                  <tr key={w.noticeNumber} className="border-b border-rule">
                    <td className="py-2 pr-4">{w.company}</td>
                    <td className="py-2 pr-4">{w.city ?? "—"}</td>
                    <td className="py-2 pr-4">{w.type} ({w.permanence.toLowerCase()})</td>
                    <td className="py-2 pr-4 text-right num">{int(w.affected)}</td>
                    <td className="py-2 pr-4 num whitespace-nowrap">{date(w.noticeDate)}</td>
                    <td className="py-2 num whitespace-nowrap">{date(w.effectiveDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Worker counts and dates are as the employer reported them in its notice. Notice numbers and full details are in the{" "}
          <SourceLink href={privateData.warn.sourceCsv}>state&apos;s WARN summary file</SourceLink>.
        </p>
      </Section>

      <Section title="Other counties in the Charlotte region">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {REGION_COUNTIES.filter((c) => c !== county).map((c) => (
            <li key={c}><Link href={`/layoffs/${countySlug(c)}`} className="text-accent hover:underline">{c}</Link></li>
          ))}
        </ul>
      </Section>
    </>
  );
}
