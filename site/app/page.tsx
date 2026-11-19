import Link from "next/link";
import { Badge, Section, SourceLink, Stat } from "@/components/ui";
import WhatChanged from "@/components/WhatChanged";
import { companies, companiesGeneratedAt, CORE_COUNTIES, statewideNonprofits as nonprofits, privateData, warnNotices } from "@/lib/data";
import { getIssues } from "@/lib/issues";
import { getNews, toneFor } from "@/lib/news";
import { latestChanges } from "@/lib/changes";
import { date, int, money, pct, signedPct, tone } from "@/lib/format";

function MiniTable({ head, rows }: { head: string[]; rows: (React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-rule bg-card">
      <table className="w-full text-sm num">
        <thead>
          <tr className="border-b border-rule text-xs uppercase tracking-wide text-muted">
            {head.map((h, i) => <th key={h} scope="col" className={`px-3 py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-rule last:border-0">
              {r.map((cell, j) => <td key={j} className={`px-3 py-2 ${j === 0 ? "text-left" : "text-right whitespace-nowrap"}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Home() {
  const issue = getIssues()[0];
  const news = getNews().slice(0, 5);
  const withFin = companies.filter((c) => c.years[0]?.revenue != null);
  const totalRevenue = withFin.reduce((s, c) => s + (c.years[0].revenue ?? 0), 0);
  const npRevenue = nonprofits.reduce((s, n) => s + (n.filings[0]?.revenue ?? 0), 0);
  const { completed } = privateData.fiscalYears;
  const contractTotal = privateData.contractors.reduce((s, c) => s + ((c[completed] as number) ?? 0), 0);

  const largest = withFin.slice().sort((a, b) => (b.years[0].revenue ?? 0) - (a.years[0].revenue ?? 0)).slice(0, 10);
  const growers = withFin.filter((c) => (c.years[0].revenue ?? 0) >= 1e8 && c.derived?.revenueGrowth != null)
    .sort((a, b) => (b.derived!.revenueGrowth ?? 0) - (a.derived!.revenueGrowth ?? 0)).slice(0, 5);
  const signals = companies.flatMap((c) => c.signals.map((f) => ({ c, f }))).sort((a, b) => b.f.date.localeCompare(a.f.date)).slice(0, 6);
  const changes = latestChanges();
  const local = companies.filter((c) => CORE_COUNTIES.includes(c.county ?? ""));
  const localWarn = warnNotices.filter((w) => CORE_COUNTIES.includes(w.county));
  const cutoff = new Date(Date.parse(companiesGeneratedAt) - 120 * 864e5).toISOString().slice(0, 10); // same window as /earnings
  const season = companies.filter((c) => c.latestQuarter?.revenue != null && c.latestQuarter.prior?.revenue != null && c.latestQuarter.end >= cutoff)
    .sort((a, b) => b.latestQuarter!.revenue! - a.latestQuarter!.revenue!).slice(0, 6);

  return (
    <>
      {issue && (
        <Link href={`/issues/${issue.slug}`} className="block rounded-lg border border-rule bg-card p-5 sm:p-6 hover:border-accent transition-colors">
          <p className="text-xs uppercase tracking-[0.16em] text-accent font-medium">Latest issue · {date(issue.date)}</p>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold mt-1">{issue.title}</h1>
          <p className="text-muted mt-2 max-w-3xl leading-relaxed">{issue.summary}</p>
          <p className="text-sm text-accent mt-3">Read the issue →</p>
        </Link>
      )}

      {news.length > 0 && (
        <Section title="Today’s news" href="/news" linkLabel="All news">
          <ul className="divide-y divide-rule rounded-md border border-rule bg-card">
            {news.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <p className="text-xs text-muted num flex items-center gap-2">{date(n.date)} <Badge tone={toneFor(n.category)}>{n.category}</Badge></p>
                <Link href={`/news/${n.id}`} className="block font-medium mt-0.5 hover:text-accent">{n.headline}</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-8">
        <Stat label="Public companies" value={int(companies.length)} sub={`${int(withFin.length)} with filed financials`} />
        <Stat label="Their combined revenue" value={money(totalRevenue)} sub="Latest fiscal year" />
        <Stat label="Top-100 nonprofits" value={money(npRevenue)} sub="Revenue, latest 990s" />
        <Stat label={`Federal contracts ${completed}`} value={money(contractTotal)} sub="Top 100 NC recipients" />
        <Stat label="Workers in WARN notices" value={int(privateData.warn.totals.workersAffected)} sub={`${privateData.warn.year} to date`} />
      </div>

      {changes && !changes.baseline && <div className="mt-8"><WhatChanged changes={changes} limit={5} /></div>}

      <div className="grid lg:grid-cols-2 gap-x-8">
        <Section title="Charlotte: Mecklenburg + Union" href="/charlotte" linkLabel="Charlotte region">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Public companies" value={int(local.length)} sub={`${money(local.reduce((s, c) => s + (c.years[0]?.revenue ?? 0), 0))} combined revenue`} />
            <Stat label={`Layoff notices ${privateData.warn.year}`} value={int(localWarn.length)} sub={`${int(localWarn.reduce((s, w) => s + w.affected, 0))} workers`} />
          </div>
        </Section>
        <Section title="Latest quarterly results" href="/earnings" linkLabel="Earnings season">
          <MiniTable
            head={["Company", "Quarter", "Revenue", "vs yr ago"]}
            rows={season.map((c) => [
              <Link key="n" href={`/companies/${c.cik}`} className="font-medium hover:text-accent">{c.name}</Link>,
              <span key="q" className="text-muted">{c.latestQuarter!.label}</span>,
              money(c.latestQuarter!.revenue),
              <span key="g" className={tone(c.latestQuarter!.revenueGrowth)}>{signedPct(c.latestQuarter!.revenueGrowth)}</span>,
            ])}
          />
        </Section>
      </div>

      <Section title="Largest North Carolina public companies" href="/companies" linkLabel="All companies">
        <MiniTable
          head={["Company", "Revenue", "Net income", "Net margin", "Rev. growth"]}
          rows={largest.map((c) => [
            <Link key="n" href={`/companies/${c.cik}`} className="font-medium hover:text-accent">{c.name} <span className="text-muted font-normal">{c.tickers[0] ?? ""}</span></Link>,
            money(c.years[0].revenue),
            <span key="ni" className={tone(c.years[0].netIncome)}>{money(c.years[0].netIncome)}</span>,
            pct(c.derived?.netMargin),
            <span key="g" className={tone(c.derived?.revenueGrowth)}>{signedPct(c.derived?.revenueGrowth)}</span>,
          ])}
        />
      </Section>

      <div className="grid lg:grid-cols-2 gap-x-8">
        <Section title="Fastest revenue growth" href="/companies">
          <p className="text-xs text-muted -mt-2 mb-3">Companies with at least $100M in revenue, latest fiscal year versus prior.</p>
          <MiniTable
            head={["Company", "Revenue", "Growth"]}
            rows={growers.map((c) => [
              <Link key="n" href={`/companies/${c.cik}`} className="font-medium hover:text-accent">{c.name}</Link>,
              money(c.years[0].revenue),
              <span key="g" className="text-pos">{signedPct(c.derived?.revenueGrowth)}</span>,
            ])}
          />
        </Section>
        <Section title="Distress signals in SEC filings">
          <p className="text-xs text-muted -mt-2 mb-3">8-K items for bankruptcy, restructuring, impairments, delisting notices or unreliable financials, last 180 days.</p>
          {signals.length === 0 ? <p className="text-sm text-muted">None in the window.</p> : (
            <ul className="divide-y divide-rule rounded-md border border-rule bg-card text-sm">
              {signals.map(({ c, f }) => (
                <li key={f.url} className="px-3 py-2">
                  <Link href={`/companies/${c.cik}`} className="font-medium hover:text-accent">{c.name}</Link>{" "}
                  <Badge tone="warn">{f.items.filter((i) => ["1.03", "2.05", "2.06", "3.01", "4.02"].includes(i.code)).map((i) => i.label).join("; ")}</Badge>
                  <span className="block text-muted text-xs mt-0.5">{date(f.date)} · <SourceLink href={f.url}>{f.form}</SourceLink></span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-x-8">
        <Section title="Largest nonprofits" href="/nonprofits">
          <MiniTable
            head={["Organization", "Revenue", "Surplus"]}
            rows={nonprofits.slice(0, 6).map((n) => [
              <Link key="n" href={`/nonprofits/${n.ein}`} className="font-medium hover:text-accent">{n.name}</Link>,
              money(n.filings[0]?.revenue ?? n.irsBmf.revenue),
              <span key="s" className={tone(n.derived?.surplus)}>{money(n.derived?.surplus)}</span>,
            ])}
          />
        </Section>
        <Section title="Latest layoff notices" href="/layoffs">
          <MiniTable
            head={["Company", "County", "Workers"]}
            rows={warnNotices.slice(0, 6).map((w) => [
              <span key="c"><span className="font-medium">{w.company}</span> <span className="text-xs text-muted">{date(w.noticeDate)}</span></span>,
              w.county,
              int(w.affected),
            ])}
          />
        </Section>
      </div>

      <Section title="New federal contract awards" href="/contracts">
        <MiniTable
          head={["Recipient", "Agency", "Amount"]}
          rows={privateData.newAwards.slice(0, 6).map((a) => [
            <a key="r" href={a.source} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-accent">{a.recipient}</a>,
            <span key="a" className="text-muted">{a.agency}</span>,
            money(a.amount),
          ])}
        />
      </Section>
    </>
  );
}
