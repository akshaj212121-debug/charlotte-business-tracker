# Monthly refresh runbook — Charlotte Business Tracker hub

Runs on the 1st of each month (scheduled task "charlotte-hub-monthly"). Goal: fresh data, one new
newsletter issue, a rebuilt site deployed to Vercel, and a commit. Every number published must come
from a data file the pipeline wrote this run. Nothing is estimated.

Working directory for commands below: `C:\Users\amogh\freelance-hq\charlotte-tracker`.

## 1. Find this month's WARN CSV link
commerce.nc.gov refuses command-line requests, so open
https://www.commerce.nc.gov/data-tools-reports/labor-market-data-tools/workforce-warn-reports/report-workforce-warn-summary-list-<YEAR>
in the browser pane and read the `files.nc.gov/...csv` link from the page
(`[...document.querySelectorAll('a')].map(a=>a.href).filter(h=>/\.csv/i.test(h))`).
In January, use the new year's page; if it doesn't exist yet, use the previous year's.

## 2. Pull data (≈20 min; caches older than 25 days are re-fetched)
```
node pipeline/lib.mjs && node pipeline/sec.mjs --test
node pipeline/sec.mjs
node pipeline/nonprofits.mjs
node pipeline/private.mjs --warn-url "<csv url from step 1>"
```
Sanity checks before going on (stop and report if any fail):
- public-companies.json has 100+ companies and Bank of America, Lowe's, Truist are present
- nonprofits.json has 100 organizations; private.json has 100 contractors and the WARN count did not go down

## 3. Write the issue
Create `site/content/issues/<YYYY-MM>.md` with the same front matter as earlier issues (title, date, summary).
Compute every figure with a node one-liner over `site/data/*.json` first; quote numbers exactly.
Rules (same as the project brief):
- Only claims the data shows. No causes, motives or outside facts unless a linked filing states them.
- Bank revenue is calculated (net interest + noninterest income); say so when you cite it.
- A delisting filed together with Item 5.01 is an acquisition, not distress.
- Federal obligations are commitments, not payments. A missing prior-year contract value means
  "not in that year's top 100", not zero.
- Lead with the month's most consequential change versus last month's issue, not a recap.
- Link companies to `/companies/<cik>`, nonprofits to `/nonprofits/<ein>`, primary filings by URL.
- Load the `humanizer` skill before drafting. No em-dashes in prose.
Re-check every number in the draft against the JSON before saving.

## 4. Build, deploy, commit
```
cd site && npm run lint && npm run build
vercel deploy --prod --yes
```
Then from the repo root commit only `charlotte-tracker/` changes:
`git add charlotte-tracker && git commit -m "docs: <Month YYYY> hub refresh and issue"` (do not push unless asked).

## 5. Report
Reply with: data counts, the issue title, the production URL, and anything that failed.
If the build or a sanity check fails, do not deploy; report the failure instead.
