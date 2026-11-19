import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WhatChanged from "@/components/WhatChanged";
import Signup from "@/components/Signup";
import { getIssue, getIssues } from "@/lib/issues";
import { getChanges } from "@/lib/changes";
import { date } from "@/lib/format";

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
  return (
    <article className="max-w-3xl">
      <p className="text-xs uppercase tracking-[0.16em] text-accent font-medium">Issue · {date(issue.date)}</p>
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight mt-1">{issue.title}</h1>
      <p className="text-lg text-muted mt-3 leading-relaxed">{issue.summary}</p>
      {changes && <div className="mt-6"><WhatChanged changes={changes} /></div>}
      {/* Source: our own content/issues/*.md; raw HTML inside it is escaped in lib/issues.ts. */}
      <div className="prose-issue mt-8" dangerouslySetInnerHTML={{ __html: issue.html }} />
      <div className="mt-12"><Signup /></div>
    </article>
  );
}
