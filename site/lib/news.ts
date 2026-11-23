// Daily news written by update.mjs into data/news.json. Every item is validated here at build time,
// so a malformed entry is skipped instead of breaking a page. All fields render as plain text.
import fs from "node:fs";
import path from "node:path";

export const NEWS_CATEGORIES = ["Earnings", "Deals", "Leadership", "Distress", "Markets", "Contracts", "Economy", "Filings"] as const;

export interface NewsItem {
  id: string;
  date: string;
  publishedAt: string;
  category: (typeof NEWS_CATEGORIES)[number];
  headline: string;
  dek: string;
  paragraphs: string[];
  whyItMatters: string;
  entities: { cik: number; name: string }[];
  sources: { label: string; url: string }[];
  model: string;
  // "desk": written by hand from the site's data, with figures checked against the linked records.
  // Absent: written by the daily pipeline (update.mjs), which inserts every figure by token.
  method?: "desk" | "pipeline";
}

const str = (v: unknown, max: number) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const safeUrl = (u: unknown) => typeof u === "string" && /^https:\/\/[^\s"<>]+$/.test(u);

function valid(x: unknown): x is NewsItem {
  const n = x as Partial<NewsItem>;
  return !!n
    && str(n.id, 120) && /^[a-z0-9-]+$/.test(n.id!)
    && str(n.date, 10) && /^\d{4}-\d{2}-\d{2}$/.test(n.date!)
    && NEWS_CATEGORIES.includes(n.category as NewsItem["category"])
    && str(n.headline, 160) && str(n.dek, 320) && str(n.whyItMatters, 420)
    && Array.isArray(n.paragraphs) && n.paragraphs.length >= 1 && n.paragraphs.length <= 3 && n.paragraphs.every((p) => str(p, 1000))
    && Array.isArray(n.sources) && n.sources.length >= 1 && n.sources.every((s) => str(s?.label, 200) && safeUrl(s?.url))
    && Array.isArray(n.entities) && n.entities.every((e) => typeof e?.cik === "number" && str(e?.name, 200));
}

let cache: NewsItem[] | null = null;
export function getNews(): NewsItem[] {
  if (cache) return cache;
  try {
    const file = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "news.json"), "utf8"));
    const items: unknown[] = Array.isArray(file?.items) ? file.items : [];
    const ok = items.filter(valid);
    if (ok.length !== items.length) console.warn(`news.json: skipped ${items.length - ok.length} invalid item(s)`);
    cache = ok.sort((a, b) => b.date.localeCompare(a.date) || b.publishedAt.localeCompare(a.publishedAt));
  } catch {
    cache = [];
  }
  return cache;
}

export const getNewsItem = (id: string) => getNews().find((n) => n.id === id);

export const toneFor = (c: string): "warn" | "accent" | "neutral" => (c === "Distress" ? "warn" : c === "Earnings" || c === "Deals" ? "accent" : "neutral");
