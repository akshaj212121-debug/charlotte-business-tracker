import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle, Section, SourceLink, Stat } from "@/components/ui";
import { CORE_COUNTIES, privateData, type Contractor } from "@/lib/data";
import { date, int, money, pct, signedPct } from "@/lib/format";

export const metadata: Metadata = {
  title: "Where federal contract money goes in your county",
  description: "A plain-English guide to federal contracts in Mecklenburg and Union counties: who gets the money, what the numbers mean, what they leave out, and how to look up any county.",
};

const { completed, prior } = privateData.fiscalYears;
const amount = (c: Contractor) => (c[completed] as number) ?? 0;

function county(name: string) {
  const list = privateData.localContractors[name] ?? [];
  const total = list.reduce((s, c) => s + amount(c), 0);
  const top5 = list.slice(0, 5).reduce((s, c) => s + amount(c), 0);
  return { name, list, total, top1: list[0], top1Share: total ? amount(list[0]) / total : null, top5Share: total ? top5 / total : null, newCount: list.filter((c) => c[prior] == null).length };
}

function Bars({ rows }: { rows: Contractor[] }) {
  const max = Math.max(...rows.map(amount), 1);
  return (
    <ul className="space-y-2">
      {rows.map((c) => (
        <li key={c.recipientId} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <a href={c.source} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-accent truncate">{c.name}</a>
            <span className="num whitespace-nowrap">{money(amount(c))} <span className="text-muted text-xs">{c[prior] == null ? `new vs ${prior}` : Math.abs(c.growth ?? 0) >= 10 ? `from ${money(c[prior] as number)}` : signedPct(c.growth)}</span></span>
          </div>
          <div className="mt-1 h-2 rounded bg-paper border border-rule overflow-hidden" aria-hidden="true">
            <div className="h-full bg-accent" style={{ width: `${Math.max((amount(c) / max) * 100, 0.5)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const TERMS: [string, React.ReactNode][] = [
  ["Contract", "A deal where a federal agency pays a business to deliver goods or services: equipment, construction, software, health care staffing. It is different from a grant (money given for a public purpose) or a benefit payment like Social Security."],
  ["Obligation", "Money the government has legally committed to pay under a contract. It is not always paid out the same year, and agencies can raise or lower it later. All dollar figures on this page are obligations."],
  ["Fiscal year", <>The federal budget year runs October 1 to September 30. {completed} is the year that ended September 30, {completed.replace("FY", "")}.</>],
  ["Recipient location", "Where the company receiving the contract has its address. That is how a contract gets assigned to a county here. The work itself may happen somewhere else."],
  ["USAspending.gov", "The official federal website that publishes every contract, grant and loan, as required by federal transparency laws (FFATA and the DATA Act). Each name on this page links to that recipient's profile there."],
];

export default function FederalMoneyPage() {
  const counties = CORE_COUNTIES.map(county);
  const stateTotal = privateData.contractors.reduce((s, c) => s + amount(c), 0);
  const byAgency = Object.entries(privateData.newAwards.reduce<Record<string, { n: number; dollars: number }>>((acc, a) => {
    const k = acc[a.agency] ?? { n: 0, dollars: 0 };
    acc[a.agency] = { n: k.n + 1, dollars: k.dollars + a.amount };
    return acc;
  }, {})).sort((a, b) => b[1].dollars - a[1].dollars);

  return (
    <>
      <PageTitle kicker="Explainer · Federal contracts" title="Where federal contract money goes in your county">
        <p>
          The federal government buys a lot from private companies, and every contract is public. This page explains,
          in plain English, which companies in Mecklenburg and Union counties received federal contract dollars in {completed},
          what those numbers mean, what they leave out, and how to look up any county yourself.
        </p>
      </PageTitle>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {counties.map((c) => <Stat key={c.name} label={`${c.name}, top 25 contractors`} value={money(c.total)} sub={`${completed} obligations`} />)}
        <Stat label="North Carolina, top 100" value={money(stateTotal)} sub={`${completed} obligations`} />
        <Stat label="New NC awards, last 60 days" value={int(privateData.newAwards.length)} sub="Largest contracts that started recently" />
      </div>

      <Section title="The short version">
        <ul className="list-disc pl-5 space-y-2 leading-relaxed max-w-3xl">
          {counties.map((c) => c.top1 && (
            <li key={c.name}>
              In <strong>{c.name} County</strong>, the 25 largest contractors received {money(c.total)}. The biggest,{" "}
              <a href={c.top1.source} target="_blank" rel="noopener noreferrer" className="underline">{c.top1.name}</a>, got {money(amount(c.top1))}, or{" "}
              <strong>{pct(c.top1Share, 0)}</strong> of that. The top five together got {pct(c.top5Share, 0)}.
            </li>
          ))}
          <li>When one company gets most of a county’s contract dollars, that county’s number can swing a lot from one year to the next because of a single contract.</li>
          <li>These are contracts only. Grants, loans, Medicaid, Social Security and other federal money are not counted here.</li>
        </ul>
      </Section>

      <Section title="Five terms that make the numbers make sense">
        <dl className="grid sm:grid-cols-2 gap-4">
          {TERMS.map(([t, d]) => (
            <div key={t} className="rounded-md border border-rule bg-card p-4">
              <dt className="font-semibold">{t}</dt>
              <dd className="text-sm text-muted mt-1 leading-relaxed">{d}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {counties.map((c) => (
        <Section key={c.name} title={`${c.name} County: the 10 largest contractors, ${completed}`}>
          <Bars rows={c.list.slice(0, 10)} />
          <p className="text-xs text-muted mt-3">
            Percent change is versus {prior} (very large jumps show the {prior} amount instead). “New” means the company was not among the county’s top 100 contractors in {prior}.
            {" "}{c.newCount} of the top 25 are new this year. Full list of 25 in the <Link href="/classroom#data" className="underline">contractors data pack</Link>.
          </p>
        </Section>
      ))}

      <Section title="Which agencies are signing new contracts in North Carolina">
        <p className="text-sm text-muted mb-3 max-w-3xl">The largest contracts that started in the last 60 days for recipients anywhere in North Carolina, grouped by the department that awarded them.</p>
        <div className="overflow-x-auto rounded-md border border-rule bg-card max-w-2xl">
          <table className="w-full text-sm num">
            <thead>
              <tr className="border-b border-rule text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-3 py-2 text-left font-medium">Department</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Contracts</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Award amounts</th>
              </tr>
            </thead>
            <tbody>
              {byAgency.map(([agency, v]) => (
                <tr key={agency} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{agency}</td>
                  <td className="px-3 py-2 text-right">{v.n}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{money(v.dollars)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-2">Each award, with its description and source record, is on the <Link href="/contracts" className="underline">federal contracts page</Link>.</p>
      </Section>

      <Section title="What these numbers don’t tell you">
        <ul className="list-disc pl-5 space-y-2 leading-relaxed max-w-3xl">
          <li><strong>Where the work happens.</strong> A company with a Charlotte address may do the work in another state, and an out-of-state company may do work in Charlotte. Those contracts count where the company is, not where the work is.</li>
          <li><strong>The county’s full total.</strong> Only the 25 largest recipients per county are shown, so the real county total is higher.</li>
          <li><strong>Subcontracts.</strong> When a prime contractor hires a local subcontractor, that money is reported separately and is not included here.</li>
          <li><strong>Other kinds of federal money.</strong> Grants to schools and cities, loans, and payments to people (Social Security, Medicare, SNAP) are separate categories on USAspending.gov.</li>
          <li><strong>Final numbers.</strong> Obligations can be revised for months after the year ends, so these figures may change at the source.</li>
        </ul>
      </Section>

      <Section title="Look up any county yourself">
        <ol className="list-decimal pl-5 space-y-2 leading-relaxed max-w-3xl">
          <li>Go to <SourceLink href="https://www.usaspending.gov/search">USAspending.gov Award Search</SourceLink>.</li>
          <li>Under Time Period, pick the fiscal year you want.</li>
          <li>Under Award Type, choose Contracts.</li>
          <li>Under Location, set Recipient Location to North Carolina and your county.</li>
          <li>Submit, then switch to the view that groups results by recipient to see who got the most.</li>
        </ol>
        <p className="text-sm text-muted mt-3 max-w-3xl">Teachers: the <Link href="/classroom/following-federal-dollars" className="underline">Following federal dollars</Link> worksheet uses this page as its reading.</p>
      </Section>

      <p className="mt-12 text-xs text-muted">
        Source: <SourceLink href="https://www.usaspending.gov/">USAspending.gov</SourceLink> API, contract award types only, recipients with a North Carolina address.
        Data pulled {date(privateData.generatedAt)}. <Link href="/methodology" className="underline">Methodology</Link>.
      </p>
    </>
  );
}
