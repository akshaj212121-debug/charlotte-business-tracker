# Monthly refresh runbook — Charlotte Business Tracker hub

Runs on the 1st of each month (scheduled task "charlotte-hub-monthly"). Goal: fresh data, one new
newsletter issue, a commit pushed to GitHub (which redeploys the site). Every number published must come
from a data file the pipeline wrote this run. Nothing is estimated.

Working directory for commands below: `C:\Users\amogh\charlotte-business-tracker`, a standalone project folder
and git repo (GitHub: charlotte-business-tracker, private). Vercel deploys the live site from every push to `main`.

## 0. Pull first
The daily news workflow commits `site/data/news.json` on GitHub every weekday, so start with
`git pull --rebase` to avoid a conflicting push later.

## 1. Find this month's WARN CSV link
commerce.nc.gov refuses command-line requests, so open
https://www.commerce.nc.gov/data-tools-reports/labor-market-data-tools/workforce-warn-reports/report-workforce-warn-summary-list-<YEAR>
in the browser pane and read the `files.nc.gov/...csv` link from the page
(`[...document.querySelectorAll('a')].map(a=>a.href).filter(h=>/\.csv/i.test(h))`).
In January, use the new year's page; if it doesn't exist yet, use the previous year's.

## 2. Pull data (≈20 min; caches older than 25 days are re-fetched)
```
node pipeline/lib.mjs && node pipeline/geo.mjs && node pipeline/sec.mjs --test && node pipeline/snapshot.mjs --test
node pipeline/sec.mjs
node pipeline/nonprofits.mjs
node pipeline/private.mjs --warn-url "<csv url from step 1>"
node pipeline/snapshot.mjs
```
Sanity checks before going on (stop and report if any fail):
- public-companies.json has 100+ companies and Bank of America, Lowe's, Truist are present; 40+ have county Mecklenburg
- nonprofits.json has 100+ organizations (top 100 statewide plus Charlotte-region additions); private.json has 100 contractors,
  localContractors for Mecklenburg and Union, and the WARN count did not go down (except in January, when the year resets)
- site/data/changes/<YYYY-MM>.json exists. From December 2026 on it must not be a baseline; if it is, the previous
  month's snapshot in site/data/history/ is missing, so stop and report

## 3. Write the issue
Create `site/content/issues/<YYYY-MM>.md` with the same front matter as earlier issues (title, date, summary).
Compute every figure with a node one-liner over `site/data/*.json` first; quote numbers exactly.
Rules (same as the project brief):
- Only claims the data shows. No causes, motives or outside facts unless a linked filing states them.
- Bank revenue is calculated (net interest + noninterest income); say so when you cite it.
- A delisting filed together with Item 5.01 is an acquisition, not distress.
- Federal obligations are commitments, not payments. A missing prior-year contract value means
  "not in that year's top 100", not zero.
- Lead with the month's most consequential change versus last month's issue, not a recap. Read
  site/data/changes/<YYYY-MM>.json first: the site renders it automatically as the "What changed" box at the
  top of the issue, so don't repeat that list. Pick the one or two items from it that deserve a paragraph.
- Required sections every month:
  - **Charlotte area** (Mecklenburg + Union first, then the other 6 region counties): local companies, layoffs
    (`county` on WARN notices), local contractors (`localContractors`), regional nonprofits (`rankRegion`).
  - **Earnings season**: from each company's `latestQuarter` (3-month figures vs the year-ago quarter). Say "Q3 FY2026"
    as labeled; fiscal quarters differ by company. Companies with `pendingReport` filed newer reports than the SEC's
    structured data shows: say that and link the filing, never fill in their numbers.
- No analyst estimates, "beat/miss" language, or price targets: none of that is public-record data.
- Link companies to `/companies/<cik>`, nonprofits to `/nonprofits/<ein>`, primary filings by URL.
- Load the `humanizer` skill before drafting. No em-dashes in prose.
Re-check every number in the draft against the JSON before saving.

## 4. Build, commit, push (push = deploy)
```
cd site && npm run lint && npm run build && cd ..
git add -A && git commit -m "docs: <Month YYYY> hub refresh and issue"
git pull --rebase && git push
```
Pushing to `main` makes Vercel rebuild and publish the live site; no `vercel deploy` needed. If the
lint or build fails, don't commit or push.

## 5. Report
Reply with: data counts, the issue title, the production URL, and anything that failed.
If the build or a sanity check fails, do not deploy; report the failure instead.
