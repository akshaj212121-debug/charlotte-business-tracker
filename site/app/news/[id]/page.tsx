import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, SourceLink } from "@/components/ui";
import { getNews, getNewsItem, toneFor } from "@/lib/news";
import { date } from "@/lib/format";

export function generateStaticParams() {
  return getNews().map((n) => ({ id: n.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const n = getNewsItem((await params).id);
  return n ? { title: n.headline, description: n.dek } : {};
}

export default async function NewsStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const n = getNewsItem((await params).id);
  if (!n) notFound();
  return (
    <article className="max-w-3xl">
      <p className="text-xs text-muted num flex items-center gap-2"><Link href="/news" className="text-accent hover:underline">Daily news</Link> · {date(n.date)} <Badge tone={toneFor(n.category)}>{n.category}</Badge></p>
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight mt-2">{n.headline}</h1>
      <p className="text-lg text-muted mt-3 leading-relaxed">{n.dek}</p>
      <div className="mt-6 space-y-4 leading-relaxed">
        {n.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>
      <aside className="mt-8 rounded-md border border-rule bg-card p-4">
        <h2 className="text-xs uppercase tracking-wide text-accent font-medium">Why it matters</h2>
        <p className="mt-1 text-sm leading-relaxed">{n.whyItMatters}</p>
      </aside>
      {n.entities.length > 0 && (
        <section className="mt-6 text-sm">
          <h2 className="text-xs uppercase tracking-wide text-muted font-medium mb-1">Company profiles</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {n.entities.map((e) => <li key={e.cik}><Link href={`/companies/${e.cik}`} className="text-accent underline underline-offset-2">{e.name}</Link></li>)}
          </ul>
        </section>
      )}
      <section className="mt-6 text-sm">
        <h2 className="text-xs uppercase tracking-wide text-muted font-medium mb-1">Sources</h2>
        <ul className="space-y-1">
          {n.sources.map((s) => <li key={s.url}><SourceLink href={s.url}>{s.label}</SourceLink></li>)}
        </ul>
      </section>
      <p className="mt-8 text-xs text-muted border-t border-rule pt-4">
        {n.method === "desk"
          ? <>Written by an AI model ({n.model}) from the public records above and this site’s data built from them. Every figure
            was checked against those records before publishing. Not investment advice.</>
          : <>Drafted by an AI model ({n.model}) from the public records above. Every figure is inserted from the record by
            software, not typed by the model, and stories that break the site’s accuracy rules are discarded. Not investment advice.</>}
      </p>
    </article>
  );
}
