// RSS 2.0 feed of daily news stories and newsletter issues, generated at build time.
import { getIssues } from "@/lib/issues";
import { getNews } from "@/lib/news";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Root-relative links inside issue HTML must be absolute for feed readers; "]]>" can't appear inside CDATA.
const absolute = (html: string) => html.replace(/href="\//g, `href="${SITE_URL}/`).replace(/]]>/g, "]]]]><![CDATA[>");

interface Entry { title: string; url: string; date: string; summary: string; html: string }

export function GET() {
  const entries: Entry[] = [
    ...getNews().slice(0, 30).map((n) => ({
      title: n.headline, url: `${SITE_URL}/news/${n.id}`, date: n.publishedAt, summary: n.dek,
      html: [...n.paragraphs.map((p) => `<p>${esc(p)}</p>`), `<p><strong>Why it matters:</strong> ${esc(n.whyItMatters)}</p>`].join(""),
    })),
    ...getIssues().map((i) => ({ title: i.title, url: `${SITE_URL}/issues/${i.slug}`, date: `${i.date}T12:00:00Z`, summary: i.summary, html: absolute(i.html) })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const items = entries.map((e) => `    <item>
      <title>${esc(e.title)}</title>
      <link>${e.url}</link>
      <guid isPermaLink="true">${e.url}</guid>
      <pubDate>${new Date(e.date).toUTCString()}</pubDate>
      <description>${esc(e.summary)}</description>
      <content:encoded><![CDATA[${e.html}]]></content:encoded>
    </item>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}</link>
    <description>Daily public-record business news and a monthly briefing on North Carolina companies, nonprofits, federal contracts and layoffs.</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
