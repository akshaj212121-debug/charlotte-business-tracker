import type { Metadata } from "next";
import { PageTitle, Section, SourceLink } from "@/components/ui";

export const metadata: Metadata = { title: "Methodology", description: "Where every figure on the Charlotte Business Tracker comes from, and what it does not cover." };

const SOURCES = [
  { name: "SEC EDGAR (data.sec.gov)", href: "https://www.sec.gov/search-filings/edgar-application-programming-interfaces", what: "Public-company financial statements (XBRL company facts), filing history and 8-K event items. A company is included when its SEC business address is in North Carolina." },
  { name: "IRS Exempt Organizations Business Master File", href: "https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf", what: "Every tax-exempt organization registered in North Carolina, used to rank the 100 largest by reported revenue." },
  { name: "ProPublica Nonprofit Explorer", href: "https://projects.propublica.org/nonprofits/", what: "Machine-readable Form 990 figures and links to the original filings." },
  { name: "USAspending.gov", href: "https://www.usaspending.gov/", what: "Federal contract obligations to recipients with a North Carolina address, and individual new awards." },
  { name: "NC Department of Commerce — WARN reports", href: "https://www.commerce.nc.gov/data-tools-reports/labor-market-data-tools/workforce-warn-reports", what: "Layoff and closure notices filed under the federal WARN Act." },
];

export default function MethodologyPage() {
  return (
    <article className="max-w-3xl">
      <PageTitle kicker="How this works" title="Methodology">
        This site reports only what public records show. It never estimates, models or fills in a number that a
        filer did not disclose.
      </PageTitle>

      <Section title="Sources">
        <ul className="space-y-4">
          {SOURCES.map((s) => (
            <li key={s.name}>
              <SourceLink href={s.href}>{s.name}</SourceLink>
              <p className="text-sm text-muted mt-1 leading-relaxed">{s.what}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Rules">
        <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
          <li><strong>Filed figures only.</strong> Revenue, income, assets and other line items appear exactly as reported. When a company restates a prior year in a later filing, the restated figure is shown.</li>
          <li><strong>Calculated figures are labeled.</strong> Margins, growth rates, return on equity, leverage and free cash flow are arithmetic on the filed figures, nothing more.</li>
          <li><strong>Private companies.</strong> Privately held businesses are not required to publish financial statements, so none appear here. For them, this site shows only the public dollar figures that do exist: federal contracts and layoff notices.</li>
          <li><strong>Timing.</strong> Public-company data reflects the latest annual report. Nonprofit Form 990s are filed up to 11 months after a fiscal year ends, so the newest nonprofit year shown is usually one to two years behind.</li>
          <li><strong>Revenue definitions differ by industry.</strong> Banks report revenue net of interest expense; insurers and utilities use their own conventions. Compare companies within an industry.</li>
          <li><strong>Gaps are shown as gaps.</strong> A dash (—) means the filer did not report that item in structured form. It does not mean zero.</li>
        </ul>
      </Section>

      <Section title="Update schedule">
        <p className="text-sm leading-relaxed">All data is re-pulled from the sources on the first of each month, and a new newsletter issue is published from that month’s records.</p>
      </Section>

      <Section title="Not investment advice">
        <p className="text-sm leading-relaxed">This is a public-records research project. Nothing here is a recommendation to buy, sell or hold any security.</p>
      </Section>
    </article>
  );
}
