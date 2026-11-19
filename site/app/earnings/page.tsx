import type { Metadata } from "next";
import Link from "next/link";
import SortableTable, { type Column, type Row } from "@/components/SortableTable";
import { PageTitle, Section, SourceLink, Stat } from "@/components/ui";
import { companies, companiesGeneratedAt } from "@/lib/data";
import { date, int, signedPct, tone } from "@/lib/format";

export const metadata: Metadata = { title: "Earnings season", description: "Latest quarterly results for North Carolina public companies, from their 10-Q filings." };

const columns: Column[] = [
  { key: "name", label: "Company", kind: "text" },
  { key: "quarter", label: "Quarter", kind: "text" },
  { key: "end", label: "Period end", kind: "date" },
  { key: "revenue", label: "Revenue", kind: "money" },
  { key: "revenueGrowth", label: "Rev. vs yr ago", kind: "signedPct", tone: true },
  { key: "netIncome", label: "Net income", kind: "money", tone: true },
  { key: "netIncomeGrowth", label: "NI vs yr ago", kind: "signedPct", tone: true },
  { key: "eps", label: "Diluted EPS", kind: "perShare" },
  { key: "filed", label: "Filed", kind: "date" },
];

export default function EarningsPage() {
  // "This season" = quarters ending within 120 days of the data pull. Older ones are listed separately.
  const cutoff = new Date(Date.parse(companiesGeneratedAt) - 120 * 864e5).toISOString().slice(0, 10);
  const reported = companies.filter((c) => c.latestQuarter && c.latestQuarter.end >= cutoff);
  const both = reported.filter((c) => c.latestQuarter!.revenue != null && c.latestQuarter!.prior?.revenue != null);
  const up = both.filter((c) => (c.latestQuarter!.revenueGrowth ?? 0) > 0).length;
  const sumCur = both.reduce((s, c) => s + c.latestQuarter!.revenue!, 0);
  const sumPrev = both.reduce((s, c) => s + c.latestQuarter!.prior!.revenue!, 0);
  const profitable = reported.filter((c) => (c.latestQuarter!.netIncome ?? 0) > 0).length;
  const pending = companies.filter((c) => c.pendingReport);

  const rows: Row[] = reported.map((c) => {
    const q = c.latestQuarter!;
    return {
      name: c.name, ticker: c.tickers[0] ?? null, city: c.city,
      quarter: q.label, end: q.end, revenue: q.revenue, revenueGrowth: q.revenueGrowth,
      netIncome: q.netIncome, netIncomeGrowth: q.netIncomeGrowth, eps: q.epsDiluted, filed: q.filed,
      href: `/companies/${c.cik}`,
    };
  });

  return (
    <>
      <PageTitle kicker="10-Q filings" title="Earnings season">
        The latest quarter each North Carolina public company has reported, compared with the same quarter a year
        earlier. Figures come from the structured data in each 10-Q. Quarter labels follow each company’s own fiscal
        calendar, so “Q3” doesn’t always mean July to September. There are no analyst estimates here, only what the filings say.
      </PageTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Stat label="Reported this season" value={int(reported.length)} sub={`Quarters ending on or after ${date(cutoff)}`} />
        <Stat label="Revenue up vs year ago" value={`${int(up)} of ${int(both.length)}`} sub="Companies with both quarters" />
        <Stat label="Combined revenue change" value={signedPct(sumPrev ? (sumCur - sumPrev) / sumPrev : null)} sub="Same companies, calculated" toneClass={tone(sumCur - sumPrev)} />
        <Stat label="Profitable this quarter" value={`${int(profitable)} of ${int(reported.length)}`} />
      </div>
      <SortableTable columns={columns} rows={rows} searchKeys={["name", "ticker", "city"]} initialSort="revenue" placeholder="Search company, ticker or city" />
      <p className="text-xs text-muted mt-2">Bank revenue is calculated as net interest income plus noninterest income. Growth versus a year-ago loss is measured against the loss’s absolute size.</p>

      {pending.length > 0 && (
        <Section title="Filed, but not yet in SEC’s structured data">
          <p className="text-sm text-muted mb-3">These companies filed a newer report than the SEC’s structured-data feed currently shows. Their newest figures are in the filing itself.</p>
          <ul className="divide-y divide-rule rounded-md border border-rule bg-card text-sm">
            {pending.map((c) => (
              <li key={c.cik} className="px-3 py-2 flex flex-wrap justify-between gap-2">
                <Link href={`/companies/${c.cik}`} className="font-medium hover:text-accent">{c.name}</Link>
                <span className="text-muted">{c.pendingReport!.form} for period ended {date(c.pendingReport!.reportDate)}, filed {date(c.pendingReport!.filed)} · <SourceLink href={c.pendingReport!.url}>Read filing</SourceLink></span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
