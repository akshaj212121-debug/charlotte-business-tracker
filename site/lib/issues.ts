// Newsletter issues are Markdown files in content/issues/<YYYY-MM>.md with a small front-matter block.
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

export interface Issue {
  slug: string;
  title: string;
  date: string;
  summary: string;
  /** Headline figures for the "The numbers" box, from repeated `stat: "value | label"` front-matter lines. */
  stats: { value: string; label: string }[];
  html: string;
}

const DIR = path.join(process.cwd(), "content", "issues");

// Issues quote text from external records (e.g. contract descriptions), so raw HTML in the
// Markdown is escaped instead of rendered. That keeps the dangerouslySetInnerHTML on the issue page safe.
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
marked.use({ renderer: { html: ({ text }) => escapeHtml(text) } });

function parse(slug: string): Issue {
  const raw = fs.readFileSync(path.join(DIR, `${slug}.md`), "utf8");
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta: Record<string, string> = {};
  const stats: Issue["stats"] = [];
  for (const line of (match?.[1] ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim().replace(/^"|"$/g, "");
    if (key === "stat") {
      const [v, ...label] = value.split("|");
      stats.push({ value: v.trim(), label: label.join("|").trim() });
    } else meta[key] = value;
  }
  return {
    slug,
    title: meta.title ?? slug,
    date: meta.date ?? slug,
    summary: meta.summary ?? "",
    stats,
    html: marked.parse(match?.[2] ?? raw, { async: false }) as string,
  };
}

export function getIssues(): Issue[] {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parse(f.replace(/\.md$/, "")))
    .sort((a, b) => b.slug.localeCompare(a.slug));
}

export function getIssue(slug: string): Issue | undefined {
  return getIssues().find((i) => i.slug === slug);
}

/** The issues just before and after `slug` in date order, for previous/next links. */
export function getAdjacentIssues(slug: string): { newer?: Issue; older?: Issue } {
  const all = getIssues(); // newest first
  const i = all.findIndex((x) => x.slug === slug);
  return i < 0 ? {} : { newer: all[i - 1], older: all[i + 1] };
}
