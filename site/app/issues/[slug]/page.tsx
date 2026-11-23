import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import WhatChanged from "@/components/WhatChanged";
import Signup from "@/components/Signup";
import { getAdjacentIssues, getIssue, getIssues } from "@/lib/issues";
import { getChanges } from "@/lib/changes";
import { date } from "@/lib/format";
import { SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return getIssues().map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const i = getIssue((await params).slug);
  return i ? { title: i.title, description: i.summary } : {};
}

export default async function IssuePage({ params }: { params: Promise<{ slug: string }> }) {
  const issue = getIssue((await params).slug);
  if (!issue) notFound();
  const changes = getChanges(issue.slug);
  const { newer, older } = getAdjacentIssues(issue.slug);
  return (
    <article className="max-w-3xl">
      <p className="text-xs uppercase tracking-[0.16em] text-accent font-medium">Issue · {date(issue.date)}</p>
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight mt-1">{issue.title}</h1>
      <p className="text-lg text-muted mt-3 leading-relaxed">{issue.summary}</p>

      {issue.stats.length > 0 && (
        <section aria-labelledby="the-numbers" className="mt-6">
          <h2 id="the-numbers" className="text-xs uppercase tracking-wide text-muted font-medium mb-2">The numbers</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-px rounded-md border border-rule bg-rule overflow-hidden">
            {issue.stats.map((s) => (
              <div key={s.value} className="bg-card p-4 min-w-0">
                <dt className="font-serif text-2xl font-semibold num">{s.value}</dt>
                <dd className="text-sm text-muted mt-1">{s.label}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {changes && <div className="mt-6"><WhatChanged changes={changes} /></div>}

      <p className="mt-6 text-sm text-muted border-l-2 border-accent pl-3">
        Get the next issue by email, free. <a href="#subscribe" className="text-accent underline">Subscribe at the bottom of this page</a>.
      </p>

      {/* Source: our own content/issues/*.md; raw HTML inside it is escaped in lib/issues.ts. */}
      <div className="prose-issue mt-8" dangerouslySetInnerHTML={{ __html: issue.html }} />

      <p className="mt-10 text-sm text-muted">
        Know someone who follows North Carolina business? Send them this issue:{" "}
        <a href={`${SITE_URL}/issues/${issue.slug}`} className="text-accent underline break-all">{`${SITE_URL}/issues/${issue.slug}`}</a>
      </p>

      {(newer || older) && (
        <nav aria-label="More issues" className="mt-6 flex flex-col sm:flex-row justify-between gap-3 border-y border-rule py-4 text-sm">
          {older ? <Link href={`/issues/${older.slug}`} className="hover:text-accent">← {older.title}</Link> : <span />}
          {newer ? <Link href={`/issues/${newer.slug}`} className="hover:text-accent sm:text-right">{newer.title} →</Link> : <span />}
        </nav>
      )}
      <p className="mt-3 text-sm"><Link href="/issues" className="text-accent underline">All issues</Link></p>

      <div className="mt-10"><Signup /></div>
    </article>
  );
}
