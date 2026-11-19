# Charlotte Business Tracker

Public-record financial hub and newsletter for North Carolina, focused on the Charlotte region.
Live site: https://charlotte-business-tracker.vercel.app

- `site/` — Next.js site. Reads only the JSON in `site/data/` (no database, no runtime API calls).
- `pipeline/` — monthly data refresh (SEC EDGAR, IRS + ProPublica 990s, USAspending, NC WARN, Census). See `MONTHLY-REFRESH.md`.
- `update.mjs` — daily news: collects new SEC filings, federal awards and BLS figures, has Claude draft stories
  under strict rules, validates them, and updates `site/data/news.json`. `node update.mjs --test` runs its self-test;
  `--dry-run` prints the facts without calling Claude.
- `.github/workflows/news.yml` — runs `update.mjs` on weekdays, builds the site, and commits `news.json`.
  Vercel rebuilds the live site from each push to `main`.

## Secrets (GitHub repo → Settings → Secrets and variables → Actions)

- `CLAUDE_CODE_OAUTH_TOKEN` (required): from `claude setup-token`. Uses the Claude subscription, not API billing.
- `SEC_USER_AGENT` (optional): e.g. `Charlotte Business Tracker you@example.com`, the contact SEC asks automated tools to send.

No API key is used anywhere, and no `.env` file is committed.
