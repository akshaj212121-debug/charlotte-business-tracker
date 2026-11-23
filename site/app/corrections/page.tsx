import type { Metadata } from "next";
import { PageTitle, Section } from "@/components/ui";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Corrections", description: "How to report an error on the Charlotte Business Tracker, and every correction made so far." };

// Add one entry per correction, newest first. Keep the wording factual: what was wrong, what is right, where.
const CORRECTIONS: { date: string; page: string; href: string; note: string }[] = [];

export default function CorrectionsPage() {
  return (
    <article className="max-w-3xl">
      <PageTitle kicker="Accuracy" title="Corrections">
        Every figure here should match a public record. When one doesn’t, it gets fixed and the fix is listed below.
      </PageTitle>

      <Section title="Report an error">
        <p className="text-sm leading-relaxed">
          {CONTACT_EMAIL
            ? <>Email <a href={`mailto:${CONTACT_EMAIL}?subject=Correction`} className="text-accent underline">{CONTACT_EMAIL}</a> with the page link, what looks wrong, and, if you have it, the record that shows the right figure.</>
            : <>A corrections address is coming soon. Please include the page link, what looks wrong, and the record that shows the right figure.</>}
          {" "}If you represent a company or organization named on this site, the fastest fix is usually a link to the filing that shows the correct number.
        </p>
      </Section>

      <Section title="How corrections are handled">
        <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
          <li>Each report is checked against the original public record.</li>
          <li>If the site was wrong, the page or story is fixed and the correction is added to the log below with the date.</li>
          <li>If the site matches the record but the record itself is wrong, the figure stays as filed. The filer can amend its filing, and the site will show the amended figure after its next update.</li>
          <li>Stories are not deleted to hide a mistake. They are corrected in place.</li>
        </ul>
      </Section>

      <Section title="Corrections log">
        {CORRECTIONS.length === 0 ? (
          <p className="text-sm text-muted">No corrections so far.</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {CORRECTIONS.map((c) => (
              <li key={`${c.date}-${c.href}`} className="py-3 text-sm">
                <p className="text-xs text-muted num">{c.date}</p>
                <a href={c.href} className="font-medium text-accent underline">{c.page}</a>
                <p className="mt-1 leading-relaxed">{c.note}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </article>
  );
}
