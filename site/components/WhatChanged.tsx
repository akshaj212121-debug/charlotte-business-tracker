// Auto-built "What changed" section: generated from the monthly data diff, never written by hand.
import Link from "next/link";
import type { Changes } from "@/lib/changes";
import { date, int, money, signedPct } from "@/lib/format";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-rule last:border-0">
      <h3 className="text-xs uppercase tracking-wide text-muted font-medium mb-1.5">{title}</h3>
      <ul className="text-sm space-y-1">{children}</ul>
    </div>
  );
}

const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export default function WhatChanged({ changes, limit = 8 }: { changes: Changes; limit?: number }) {
  if (changes.baseline) {
    return (
      <aside className="rounded-md border border-rule bg-card p-4 text-sm text-muted">
        <strong className="text-ink">What changed:</strong> tracking starts with this issue. From the next issue on,
        this box lists every new layoff notice, distress filing, annual and quarterly report, and federal contractor
        entering or leaving the top 100 since the previous month, built automatically from the data.
      </aside>
    );
  }
  const c = changes;
  const empty = ![c.newWarn, c.newSignals, c.newAnnualReports, c.newQuarterlyReports, c.companiesAdded, c.companiesRemoved, c.contractorsEntered, c.contractorsExited, c.nonprofitNew990s, c.newAwards].some((x) => x?.length);
  return (
    <aside className="rounded-md border border-accent/40 bg-card p-4" aria-labelledby="what-changed">
      <h2 id="what-changed" className="font-serif text-xl font-semibold">What changed since {c.previousMonth ? monthName(c.previousMonth) : "last month"}</h2>
      <p className="text-xs text-muted mt-0.5 mb-2">Built automatically by comparing this month’s data with last month’s.</p>
      {empty && <p className="text-sm text-muted">No changes in the tracked records.</p>}

      {!!c.newWarn?.length && (
        <Block title={`New layoff and closure notices: ${int(c.newWarn.length)} (${int(c.newWarnWorkers)} workers)`}>
          {c.newWarn.slice(0, limit).map((w) => (
            <li key={w.id}><strong className="font-medium">{w.company}</strong>, {w.city ?? w.county}: {int(w.affected)} workers, {w.type.toLowerCase()}, effective {date(w.effectiveDate)}</li>
          ))}
          {c.newWarn.length > limit && <li className="text-muted"><Link href="/layoffs" className="underline">{c.newWarn.length - limit} more</Link></li>}
        </Block>
      )}
      {!!c.newSignals?.length && (
        <Block title={`New distress filings: ${c.newSignals.length}`}>
          {c.newSignals.slice(0, limit).map((s) => (
            <li key={s.id}><Link href={`/companies/${s.cik}`} className="font-medium hover:text-accent">{s.name}</Link>, {date(s.date)}: {s.items.join("; ")}. <a href={s.id} target="_blank" rel="noopener noreferrer" className="text-accent underline">{s.form}</a></li>
          ))}
        </Block>
      )}
      {!!c.newQuarterlyReports?.length && (
        <Block title={`New quarterly results: ${c.newQuarterlyReports.length} companies`}>
          {c.newQuarterlyReports.slice(0, limit).map((q) => (
            <li key={q.id}><Link href={`/companies/${q.id}`} className="font-medium hover:text-accent">{q.name}</Link> {q.qLabel}: revenue {money(q.qRevenue)} ({signedPct(q.qRevenueGrowth)} vs year-ago quarter), net income {money(q.qNetIncome)}</li>
          ))}
          {c.newQuarterlyReports.length > limit && <li className="text-muted"><Link href="/earnings" className="underline">{c.newQuarterlyReports.length - limit} more on the earnings page</Link></li>}
        </Block>
      )}
      {!!c.newAnnualReports?.length && (
        <Block title={`New annual reports: ${c.newAnnualReports.length}`}>
          {c.newAnnualReports.slice(0, limit).map((a) => (
            <li key={a.id}><Link href={`/companies/${a.id}`} className="font-medium hover:text-accent">{a.name}</Link>, fiscal year ended {date(a.fyEnd)}: revenue {money(a.revenue)}, net income {money(a.netIncome)}</li>
          ))}
        </Block>
      )}
      {(!!c.companiesAdded?.length || !!c.companiesRemoved?.length) && (
        <Block title="SEC registrant list">
          {c.companiesAdded?.map((a) => <li key={a.id}>Added: <Link href={`/companies/${a.id}`} className="font-medium hover:text-accent">{a.name}</Link></li>)}
          {c.companiesRemoved?.map((a) => <li key={a.id}>No longer listed: {a.name} (deregistered, moved, or stopped filing structured data)</li>)}
        </Block>
      )}
      {c.contractorFYChanged && (
        <Block title="Federal contractors"><li>A new federal fiscal year closed, so the top-100 contractor ranking now covers a new year. See <Link href="/contracts" className="underline">contracts</Link>.</li></Block>
      )}
      {(!!c.contractorsEntered?.length || !!c.contractorsExited?.length) && (
        <Block title="Top-100 federal contractors">
          {c.contractorsEntered?.slice(0, limit).map((a) => <li key={a.id}>Entered: <strong className="font-medium">{a.name}</strong> ({money(a.amount)})</li>)}
          {c.contractorsExited?.slice(0, limit).map((a) => <li key={a.id}>Left: {a.name}</li>)}
        </Block>
      )}
      {!!c.newAwards?.length && (
        <Block title={`New large contract awards: ${c.newAwards.length}`}>
          {c.newAwards.slice(0, 5).map((a) => <li key={a.id}><a href={a.source} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-accent">{a.recipient}</a>: {money(a.amount)} from {a.agency}</li>)}
        </Block>
      )}
      {!!c.nonprofitNew990s?.length && (
        <Block title={`New nonprofit 990s: ${c.nonprofitNew990s.length}`}>
          {c.nonprofitNew990s.slice(0, limit).map((n) => <li key={n.id}><Link href={`/nonprofits/${n.id}`} className="font-medium hover:text-accent">{n.name}</Link>, tax year {n.taxYear}: revenue {money(n.revenue)}</li>)}
        </Block>
      )}
    </aside>
  );
}
