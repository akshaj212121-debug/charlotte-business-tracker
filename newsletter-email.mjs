// Turns a newsletter issue into a paste-ready email for Buttondown.
// Usage: node newsletter-email.mjs [YYYY-MM]   (defaults to the newest issue)
// Writes outreach/newsletter/<YYYY-MM>-buttondown.md. Paste the "Subject" line into Buttondown's subject
// field and everything below the divider into the body (Buttondown accepts Markdown).
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ISSUES = path.join(ROOT, "site", "content", "issues");
const siteTs = fs.readFileSync(path.join(ROOT, "site", "lib", "site.ts"), "utf8");
const SITE_URL = siteTs.match(/SITE_URL\s*=\s*"([^"]+)"/)?.[1];
if (!SITE_URL) throw new Error("SITE_URL not found in site/lib/site.ts");

const slug = process.argv[2] ?? fs.readdirSync(ISSUES).filter((f) => /^\d{4}-\d{2}\.md$/.test(f)).sort().at(-1)?.replace(/\.md$/, "");
if (!slug) throw new Error("No issues found");
const raw = fs.readFileSync(path.join(ISSUES, `${slug}.md`), "utf8").replace(/\r\n/g, "\n");
const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!m) throw new Error("Issue has no front matter");

const meta = {};
const stats = [];
for (const line of m[1].split("\n")) {
  const i = line.indexOf(":");
  if (i <= 0) continue;
  const key = line.slice(0, i).trim();
  const value = line.slice(i + 1).trim().replace(/^"|"$/g, "");
  if (key === "stat") {
    const [v, ...label] = value.split("|");
    stats.push(`- **${v.trim()}**: ${label.join("|").trim()}`);
  } else meta[key] = value;
}

// Root-relative links ("](/companies/...)") must be absolute in an email.
const body = m[2].trim().replace(/\]\(\//g, `](${SITE_URL}/`);
const issueUrl = `${SITE_URL}/issues/${slug}`;

const out = [
  `Subject: ${meta.title ?? slug}`,
  "",
  "---",
  "",
  `*${meta.summary ?? ""}*`,
  "",
  `[Read this issue on the web](${issueUrl})`,
  "",
  ...(stats.length ? ["## The numbers", "", ...stats, ""] : []),
  body,
  "",
  "---",
  "",
  `Forwarded this? Get the next issue free at ${SITE_URL}/issues. Know someone who follows North Carolina business? Send them ${issueUrl}.`,
  "",
  `Every figure comes from public records: SEC filings, IRS Form 990s, USAspending.gov and N.C. Department of Commerce WARN notices. How the numbers are built: ${SITE_URL}/methodology`,
  "",
].join("\n");

const dir = path.join(ROOT, "outreach", "newsletter");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${slug}-buttondown.md`);
fs.writeFileSync(file, out);
console.log(`Wrote ${path.relative(ROOT, file)}`);
