import type { Metadata } from "next";
import Link from "next/link";
import NewsList, { type NewsSummary } from "@/components/NewsList";
import { PageTitle } from "@/components/ui";
import { getNews, NEWS_CATEGORIES, toneFor } from "@/lib/news";

export const metadata: Metadata = { title: "Daily news", description: "Original daily business news for North Carolina, written from SEC filings, federal contract records and labor statistics." };

export default function NewsPage() {
  const items: NewsSummary[] = getNews().map((n) => ({ id: n.id, date: n.date, category: n.category, headline: n.headline, dek: n.dek, tone: toneFor(n.category) }));
  return (
    <>
      <PageTitle kicker="Updated every weekday" title="Daily news">
        Original reporting on North Carolina business, written each weekday morning from that day’s public records:
        SEC filings, federal contract awards and Bureau of Labor Statistics data. Stories are drafted by an AI model
        under strict rules and every figure is filled in from the record itself. <Link href="/methodology#news" className="underline">How it works</Link>.
      </PageTitle>
      {items.length ? <NewsList items={items} categories={[...NEWS_CATEGORIES]} /> : <p className="text-muted">The first stories arrive with the next weekday update.</p>}
    </>
  );
}
