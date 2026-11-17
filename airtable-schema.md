# Charlotte Business Tracker — Airtable Schema

Base name: **Charlotte Business Tracker**
Coverage: **Mecklenburg** and **Union** counties, NC
Tables: **Entities**, **Filings**, **News**, **Metrics**, **Issues**

## Ground Rules (enforced by the schema)

1. **No fabricated data.** A filing is publishable only when its primary document has been reviewed and its document number and source URL are recorded (`Publish Ready` formula).
2. **Registry vs. news.** News lives only in the **News** table. `Source Type` in **Filings** has no "News" option.
3. **Cash flow.** Cash-flow figures publish only from an **SEC Disclosure** or a **Ch 11 MOR** (`Publish Ready` blocks anything else).
4. **Raw record kept.** Every filing stores the source text as-is in `Raw Record`. Never edit it; corrections go in other fields.
5. **Business entities only.** Track registered entities (those with an NCSOS SOSID). No consumer bankruptcies, no individuals.

---

## 1. Entities

| Field | Type | Required | Options / Notes |
|---|---|---|---|
| **Legal Name** | Single line text (primary) | Yes | Exact name as shown on NCSOS |
| NCSOS SOSID | Single line text | Yes | Unique key. Airtable can't enforce uniqueness — use the "Duplicate SOSIDs" view |
| Entity Type | Single select | Yes | LLC, Corporation, LP, Nonprofit, Other |
| County | Multiple select | Yes | Mecklenburg, Union |
| Principal Address | Long text | No | From NCSOS |
| Registered Agent | Single line text | No | From NCSOS |
| NCSOS Status | Single select | Yes | Seed: Current-Active, Admin Dissolved, Dissolved, Withdrawn. Copy exact status text from NCSOS; add new options as encountered |
| Formation Date | Date | No | From NCSOS |
| Industry | Single select | No | Banking & Finance, Real Estate, Construction, Restaurants & Hospitality, Retail, Healthcare, Logistics, Technology, Professional Services, Manufacturing, Other |
| Ticker | Single line text | No | SEC filers only |
| Filings | Link → Filings | — | Created in build step 3 |
| News | Link → News | — | Created in build step 3 |
| **Distress Signal Count** | Count (of Filings) | — | Condition: only linked Filings where `Signal Category` = Distress |

## 2. Filings

One record per public-record event.

| Field | Type | Required | Options / Notes |
|---|---|---|---|
| **Filing** | Formula (primary) | — | See formulas below. Start as text, convert after links exist |
| Entity | Link → Entities | Yes | |
| Filing Type | Single select | Yes | Formation, Admin Dissolution, Voluntary Dissolution, Reinstatement, UCC Financing Statement, Federal Tax Lien, Federal Tax Lien Release, NC Certificate of Tax Liability, Claim of Lien on Real Property, Lis Pendens, Foreclosure Special Proceeding, Civil Judgment, Bankruptcy Petition Ch 7, Bankruptcy Petition Ch 11 / Subchapter V, Ch 11 MOR, SEC 8-K, WARN Notice, Commercial Deed |
| Signal Category | Single select | Yes | Formation, Distress, Recovery, Disclosure, Real Estate |
| Filing Date | Date | Yes | Date on the document |
| Recorded / Docket Date | Date | No | Date the office recorded or docketed it |
| County | Single select | Yes | Mecklenburg, Union |
| Source Registry | Single select | Yes | NCSOS, Mecklenburg ROD, Union ROD, Mecklenburg Clerk (eCourts), Union Clerk (eCourts), PACER WDNC, SEC EDGAR, NC Commerce WARN |
| Source Type | Single select | Yes | Public Registry, Court Record, SEC Disclosure, Government Report. **No "News" option.** |
| Document / Case No. | Single line text | Yes | Book/page, case number, or SOS filing number — whatever lets someone else re-pull the exact document |
| Source URL | URL | Yes | Session-based portals (ROD, PACER) may not give a permanent link: store the search page URL and rely on Document / Case No. For PACER, a free CourtListener RECAP copy is fine if one exists |
| Amount | Currency (USD) | No | Only a figure printed in the document |
| Amount Basis | Single select | If Amount | Stated in document, Not stated, N/A |
| Amount Kind | Single select | If Amount | Lien / Judgment, Claim, Sale Price, Cash Flow |
| Verification Status | Single select | Yes | Primary doc reviewed, Index entry only, Unverified – do not publish |
| Verified By | Single line text | If verified | |
| Verified Date | Date | If verified | |
| Raw Record | Long text | Yes | Source text pasted as-is. Never edited |
| Why It Matters | Long text | Before publishing | 1–2 analytical sentences. No claims beyond what the document shows |
| **Publish Ready** | Formula | — | See formulas below |
| News | Link → News | — | Reverse side of News.Corroborating Filings |
| Issue | Link → Issues | — | |

## 3. News

Reporting only. Never a substitute for a filing.

| Field | Type | Required | Options / Notes |
|---|---|---|---|
| **Headline** | Single line text (primary) | Yes | Exact headline |
| Outlet | Single line text | Yes | e.g. publication name |
| Publish Date | Date | Yes | |
| URL | URL | Yes | |
| Claim Summary | Long text | Yes | What the article claims, attributed to the outlet |
| Entities | Link → Entities | No | |
| Corroborating Filings | Link → Filings | No | Filings that confirm the claim |
| **Corroborated** | Count (of Corroborating Filings) | — | 0 = reported, not verified in a public record |
| Issue | Link → Issues | — | |

## 4. Metrics

Aggregate figures (e.g., monthly formation counts). Keeps record count low.

| Field | Type | Required | Options / Notes |
|---|---|---|---|
| **Metric Period** | Formula (primary) | — | See formulas below |
| Metric | Single select | Yes | e.g. New LLC formations – Mecklenburg, New LLC formations – Union. Add as needed |
| Period Start | Date | Yes | |
| Period End | Date | Yes | |
| Value | Number | Yes | |
| Unit | Single select | Yes | Count, USD, Percent |
| Source Registry | Single select | Yes | NCSOS, Mecklenburg ROD, Union ROD, Mecklenburg Clerk (eCourts), Union Clerk (eCourts), PACER WDNC, SEC EDGAR, NC Commerce WARN, BLS, US Census Bureau |
| Source URL | URL | Yes | |
| Method | Long text | Yes | Exact search, filters, and date run — enough for anyone to reproduce the number |
| Verification Status | Single select | Yes | Primary doc reviewed, Index entry only, Unverified – do not publish |
| Issue | Link → Issues | — | |

## 5. Issues

| Field | Type | Required | Options / Notes |
|---|---|---|---|
| **Issue Title** | Single line text (primary) | Yes | |
| Publish Date | Date | No | |
| Status | Single select | Yes | Drafting, Fact-check, Published, Correction issued |
| Filings | Link → Filings | — | Auto-paired with Filings.Issue |
| News | Link → News | — | Auto-paired with News.Issue |
| Metrics | Link → Metrics | — | Auto-paired with Metrics.Issue |
| Editor Notes | Long text | No | |

---

## Formulas

**Filings → Filing** (primary)
```
{Filing Type} & " | " & {Entity} & " | " &
IF({Filing Date}, DATETIME_FORMAT({Filing Date}, 'YYYY-MM-DD'), "no date")
```

**Filings → Publish Ready**
```
IF(
  AND(
    {Verification Status} = "Primary doc reviewed",
    {Document / Case No.},
    {Source URL},
    {Raw Record},
    OR(NOT({Amount}), AND({Amount Basis} = "Stated in document", {Amount Kind})),
    OR(
      {Amount Kind} != "Cash Flow",
      {Source Type} = "SEC Disclosure",
      {Filing Type} = "Ch 11 MOR"
    )
  ),
  "YES",
  "NO"
)
```

**Metrics → Metric Period** (primary)
```
{Metric} & " | " &
IF({Period Start}, DATETIME_FORMAT({Period Start}, 'YYYY-MM-DD'), "?") & " to " &
IF({Period End}, DATETIME_FORMAT({Period End}, 'YYYY-MM-DD'), "?")
```

## Views

| Table | View | Filter / Sort |
|---|---|---|
| Filings | Publishable | `Publish Ready` = YES |
| Filings | Needs verification | `Verification Status` ≠ Primary doc reviewed; sort `Filing Date` newest first |
| Filings | Distress – last 30 days | `Signal Category` = Distress AND `Filing Date` is within past 30 days |
| Entities | Repeat distress | `Distress Signal Count` ≥ 2; sort descending |
| Entities | Duplicate SOSIDs | Group by `NCSOS SOSID` (any group with 2+ records is a duplicate) |
| News | Uncorroborated | `Corroborated` = 0 |

## Build Order (manual, ~45–60 min)

Already built in base `appUf5fd4wfFs73bh`: `build-base.mjs` created the tables, fields, links, `Publish Ready` and `Corroborated`, and the rest was finished in the Airtable UI. Use `node build-base.mjs check` to re-test `Publish Ready`. Follow the steps below only to rebuild from scratch.

1. Create the base and the 5 tables. Rename each primary field (`Legal Name`, `Filing`, `Headline`, `Metric Period`, `Issue Title`) — leave `Filing` and `Metric Period` as text for now.
2. Add every plain field (text, select, date, number, currency, URL) from the tables above.
3. Add one side of each link: Filings.Entity, Filings.Issue, News.Entities, News.Corroborating Filings, News.Issue, Metrics.Issue. Airtable auto-creates the other side (Entities.Filings, Entities.News, Filings.News, Issues.Filings, Issues.News, Issues.Metrics) — rename those to match this doc. Don't create them by hand or you get duplicate link pairs.
4. Add count fields (`Distress Signal Count`, `Corroborated`), then convert `Filing` and `Metric Period` to formulas and add `Publish Ready`.
5. Create the views.

## Intake Rules

1. Pull the record from the source registry. Paste the source text into `Raw Record` untouched.
2. Fill `Document / Case No.` and `Source URL` before anything else.
3. Link or create the **Entity** (look up its SOSID on NCSOS first). No SOSID = not a registered entity = don't track it.
4. Set `Verification Status` honestly. Index search results without opening the document = "Index entry only".
5. Write `Why It Matters` last, from the document only.

## Record Limits

Airtable's free plan caps records per base (1,000 as of last check — confirm on Airtable's pricing page). Mecklenburg formations alone would exceed that. Log individual **Formation** filings only when notable; track volume as a monthly **Metrics** row.
