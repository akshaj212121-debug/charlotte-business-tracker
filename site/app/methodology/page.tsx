import type { Metadata } from "next";
import { PageTitle, Section, SourceLink } from "@/components/ui";

export const metadata: Metadata = { title: "Methodology", description: "Where every figure on the Charlotte Business Tracker comes from, and what it does not cover." };

const SOURCES = [
  { name: "SEC EDGAR (data.sec.gov)", href: "https://www.sec.gov/search-filings/edgar-application-programming-interfaces", what: "Public-company financial statements (XBRL company facts), filing history and 8-K event items. A company is included when its SEC business address is in North Carolina." },
  { name: "IRS Exempt Organizations Business Master File", href: "https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf", what: "Every tax-exempt organization registered in North Carolina, used to rank the 100 largest by reported revenue." },
  { name: "ProPublica Nonprofit Explorer", href: "https://projects.propublica.org/nonprofits/", what: "Machine-readable Form 990 figures and links to the original filings." },
  { name: "USAspending.gov", href: "https://www.usaspending.gov/", what: "Federal contract obligations to recipients with a North Carolina address, and individual new awards." },
  { name: "NC Department of Commerce — WARN reports", href: "https://www.commerce.nc.gov/data-tools-reports/labor-market-data-tools/workforce-warn-reports", what: "Layoff and closure notices filed under the federal WARN Act." },
  { name: "U.S. Census Bureau — 2020 ZCTA-to-county relationship file", href: "https://www.census.gov/geographies/reference-files/time-series/geo/relationship-files.2020.html", what: "Maps ZIP code areas to counties, used to place companies and nonprofits in the Charlotte region." },
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
          <li><strong>Quarterly results.</strong> The earnings page uses the three-month figures in each company’s latest 10-Q and compares them with the same quarter a year earlier, usually reported in the same filing. Quarter labels follow the company’s own fiscal calendar. When a company has filed a newer report than the SEC’s structured-data feed shows, its page says so and links to the filing.</li>
          <li><strong>Counties and the Charlotte region.</strong> Each company’s and nonprofit’s county comes from its ZIP code, using the Census Bureau’s 2020 ZCTA-to-county relationship file; a ZIP spanning two counties is assigned to the one holding most of its land. ZIP codes used by a single building or PO boxes have no Census area, so for those the county most NC exempt organizations in the same city are registered in is used. The Charlotte region is Mecklenburg and Union plus the six other NC counties of the Charlotte–Concord–Gastonia metro area (OMB Bulletin 23-01).</li>
          <li><strong>What changed.</strong> Each monthly run saves a snapshot of the data and compares it with the previous month’s. The “What changed” box in each issue is generated from that comparison, not written by hand.</li>
          <li><strong>Timing.</strong> Public-company data reflects the latest annual report. Nonprofit Form 990s are filed up to 11 months after a fiscal year ends, so the newest nonprofit year shown is usually one to two years behind.</li>
          <li><strong>Revenue definitions differ by industry.</strong> Banks report revenue net of interest expense; insurers and utilities use their own conventions. Compare companies within an industry.</li>
          <li><strong>Gaps are shown as gaps.</strong> A dash (—) means the filer did not report that item in structured form. It does not mean zero.</li>
        </ul>
      </Section>

      <section id="news" className="mt-12">
        <h2 className="font-serif text-xl sm:text-2xl font-semibold border-b border-rule pb-2 mb-4">How the daily news is written</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
          <li><strong>Original, from records.</strong> Each weekday morning an automated job collects new SEC filings from North Carolina companies, new federal contract awards of $5 million or more, and new Bureau of Labor Statistics unemployment figures. No news articles are used or rewritten.</li>
          <li><strong>Drafted by AI, under rules.</strong> An AI model ({`Claude Opus 5.5`}) drafts short stories from those records only. It may not add outside facts, explain causes, predict outcomes or invent quotes.</li>
          <li><strong>Numbers come from the record.</strong> The model never types a figure. It writes placeholders, and software fills in each amount, percentage and date from the source data. Any story containing a typed number, a word like “rose” or “fell”, or a record it wasn’t given is discarded automatically.</li>
          <li><strong>Sources on every story.</strong> Each story links to the filings or records it was written from. 8-K stories report which official event items a company filed; they don’t describe the filing’s contents beyond that.</li>
          <li><strong>Desk stories are different.</strong> Stories marked as desk stories are written by an AI model directly from the filings they link to, including the text of 8-Ks and 10-Qs, so they can describe what a filing says. Every figure in them is checked against those filings before publishing, and they follow the same rules: no outside facts, no guessed causes, no invented quotes.</li>
          <li><strong>Before publishing,</strong> the job rebuilds the whole site; if anything fails, nothing is published that day.</li>
          <li><strong>No human edits each story before it appears.</strong> Stories publish automatically once they pass the checks above, so those checks are the safeguard. If you spot an error, please <a href="/corrections" className="text-accent underline">report it</a>; corrected stories are fixed and the correction is noted.</li>
        </ul>
      </section>

      <Section title="Update schedule">
        <p className="text-sm leading-relaxed">All data is re-pulled from the sources on the first of each month, and a new newsletter issue is published from that month’s records. New issues are also published to the <a href="/feed.xml" className="text-accent underline">RSS feed</a>.</p>
        <p className="text-sm leading-relaxed mt-3">The September and October 2026 issues are archive editions. They were written on Nov. 23, 2026, from records dated in those months, before the newsletter launched, and they say so at the top. They have no “What changed” box because no snapshot was saved in those months. Between monthly runs, new SEC filings may be added to company pages from EDGAR without re-pulling the financial statements.</p>
      </Section>

      <Section title="Not investment advice">
        <p className="text-sm leading-relaxed">This is a public-records research project. Nothing here is a recommendation to buy, sell or hold any security.</p>
      </Section>
    </article>
  );
}
