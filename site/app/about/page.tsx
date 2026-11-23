import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle, Section } from "@/components/ui";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "About", description: "What the Charlotte Business Tracker is, who it is for, and how it stays accurate." };

export default function AboutPage() {
  return (
    <article className="max-w-3xl">
      <PageTitle kicker="About" title="About this site">
        The Charlotte Business Tracker is a free, independent public-records project about business in the
        Charlotte region and North Carolina. Every figure links to the filing or record it came from.
      </PageTitle>

      <Section title="What it does">
        <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
          <li>Collects public records: SEC filings, IRS Form 990s, federal contract awards, WARN layoff notices and government statistics.</li>
          <li>Turns them into searchable pages for companies, nonprofits, contracts and layoffs, plus a monthly newsletter and short daily stories.</li>
          <li>Links every number to its source so readers can check it themselves.</li>
        </ul>
      </Section>

      <Section title="What it is not">
        <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
          <li><strong>Not a newsroom.</strong> There are no reporters, interviews or scoops. Stories describe what a record shows and nothing more.</li>
          <li><strong>Not an estimate.</strong> If a company didn’t disclose a number, the site doesn’t guess it.</li>
          <li><strong>Not investment advice.</strong> Nothing here is a recommendation to buy, sell or hold anything.</li>
        </ul>
      </Section>

      <Section title="Who runs it">
        <p className="text-sm leading-relaxed">
          This is a non-commercial project run by an independent volunteer in the Charlotte area. It has no
          advertisers, sponsors or paid placements, and no company can pay to be included, excluded or described
          differently. The data pipeline and daily stories are automated; how that works is explained on
          the <Link href="/methodology" className="text-accent underline">methodology page</Link>.
        </p>
      </Section>

      <Section title="Contact">
        <p className="text-sm leading-relaxed">
          {CONTACT_EMAIL ? <>Questions, tips about public records, or a data request: <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline">{CONTACT_EMAIL}</a>. </> : <>A contact address is coming soon. </>}
          To report an error, see <Link href="/corrections" className="text-accent underline">Corrections</Link>.
          How the site handles data about you is on the <Link href="/privacy" className="text-accent underline">privacy page</Link>.
        </p>
      </Section>
    </article>
  );
}
