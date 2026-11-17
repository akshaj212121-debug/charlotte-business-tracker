import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { getIssues } from "@/lib/issues";
import { date } from "@/lib/format";

export const metadata: Metadata = { title: "Newsletter", description: "Monthly briefings on North Carolina business filings, earnings, nonprofits, contracts and layoffs." };

export default function IssuesPage() {
  const issues = getIssues();
  return (
    <>
      <PageTitle kicker="Monthly" title="The newsletter">
        A monthly briefing built from that month’s public filings. Every number links back to the record it came from.
      </PageTitle>
      <ul className="divide-y divide-rule border-y border-rule">
        {issues.map((i) => (
          <li key={i.slug} className="py-5">
            <p className="text-xs text-muted num">{date(i.date)}</p>
            <Link href={`/issues/${i.slug}`} className="font-serif text-xl font-semibold hover:text-accent">{i.title}</Link>
            <p className="text-muted mt-1 max-w-3xl">{i.summary}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
