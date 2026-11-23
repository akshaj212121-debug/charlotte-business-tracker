// One-page classroom worksheets. Each has a student sheet and a teacher guide. Worked examples and answer keys are
// computed from the site's data at build time, so they always match the current CSV downloads.
import Link from "next/link";
import { SourceLink } from "@/components/ui";
import { median, packHref, pctChange, share } from "@/lib/classroom";
import { companies, inRegion, nonprofits, privateData, warnNotices } from "@/lib/data";
import { date, int, money, pct, signedPct } from "@/lib/format";

export interface Worksheet {
  slug: string;
  title: string;
  question: string;
  subjects: string[];
  minutes: number;
  packs: string[];
  Student: () => React.ReactNode;
  Teacher: () => React.ReactNode;
}

// ---------- shared bits ----------

function Lines({ n = 2 }: { n?: number }) {
  return <div aria-hidden="true">{Array.from({ length: n }, (_, i) => <div key={i} className="h-7 border-b border-rule" />)}</div>;
}

function Q({ n, children, lines = 2 }: { n: number; children: React.ReactNode; lines?: number }) {
  return (
    <li className="break-inside-avoid">
      <p><span className="font-semibold">{n}.</span> {children}</p>
      {lines > 0 && <Lines n={lines} />}
    </li>
  );
}

function FillTable({ head, rows }: { head: string[]; rows: (string | null)[][] }) {
  return (
    <table className="w-full text-sm num border border-rule my-3">
      <thead>
        <tr className="bg-paper">
          {head.map((h) => <th key={h} scope="col" className="border border-rule px-2 py-1.5 text-left font-medium">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => <td key={j} className="border border-rule px-2 py-1.5 h-8">{c ?? ""}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Key({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <ol className="list-decimal pl-5 space-y-1.5">
      {items.map(([q, a], i) => <li key={i}><span className="text-muted">{q}</span> <span className="font-medium">{a}</span></li>)}
    </ol>
  );
}

function GuideBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 break-inside-avoid">
      <h3 className="font-semibold mb-1.5">{title}</h3>
      <div className="space-y-2 leading-relaxed">{children}</div>
    </div>
  );
}

const PackLink = ({ slug }: { slug: string }) => <a href={packHref(slug)} className="text-accent underline underline-offset-2">{slug}.csv</a>;

// ---------- 1. Is this company growing? ----------

const isBankOrInsurer = (sic: string) => sic.startsWith("6");
const growthExample = companies
  .filter((c) => inRegion(c.county) && !isBankOrInsurer(c.sic) && c.years.length >= 2
    && c.years[0].revenue != null && c.years[1].revenue != null && c.years[0].netIncome != null && c.years[1].netIncome != null)
  .sort((a, b) => b.years[0].revenue! - a.years[0].revenue!)[0];

function GrowthStudent() {
  const c = growthExample;
  const [y0, y1] = c ? [c.years[0], c.years[1]] : [];
  return (
    <>
      <p>Revenue is the money a company takes in from customers. Net income is what is left after every expense and tax. A company can grow one without the other.</p>
      {c && y0 && y1 && (
        <>
          <h3 className="font-semibold mt-4">Part A. Practice with {c.name}</h3>
          <p className="text-sm text-muted">From its annual 10-K filings with the SEC.</p>
          <FillTable
            head={["", `Year ending ${date(y1.end)}`, `Year ending ${date(y0.end)}`, "Percent change"]}
            rows={[
              ["Revenue", money(y1.revenue, 2), money(y0.revenue, 2), null],
              ["Net income", money(y1.netIncome, 2), money(y0.netIncome, 2), null],
              ["Net margin (net income ÷ revenue)", null, null, "—"],
            ]}
          />
        </>
      )}
      <h3 className="font-semibold mt-4">Part B. Your company</h3>
      <p>Open <PackLink slug="nc-public-companies-annual" /> and pick a different company. Fill in the same table for its two latest years.</p>
      <FillTable head={["Company:", "Earlier year", "Later year", "Percent change"]} rows={[["Revenue", null, null, null], ["Net income", null, null, null], ["Net margin", null, null, "—"]]} />
      <ol className="space-y-3 mt-4">
        <Q n={1}>Percent change = (later − earlier) ÷ earlier. Did your company’s revenue grow? By what percent?</Q>
        <Q n={2}>Did net income grow faster or slower than revenue? What happened to the net margin, and what could explain it?</Q>
        <Q n={3}>A classmate’s company added more dollars of revenue than yours but grew by a smaller percent. Which one is “growing faster”? Why do analysts compare percents, not dollars?</Q>
        <Q n={4}>These are nominal dollars, not adjusted for inflation. Find the inflation rate for the same year (BLS Consumer Price Index). Did revenue grow faster than prices?</Q>
        <Q n={5} lines={3}>Open the company’s filings from the source_url column. Find one sentence where the company explains why revenue changed. Write it down with the filing name.</Q>
      </ol>
    </>
  );
}

function GrowthTeacher() {
  const c = growthExample;
  if (!c) return <p>No example company is available in the current data.</p>;
  const [y0, y1] = [c.years[0], c.years[1]];
  const m0 = share(y0.netIncome, y0.revenue), m1 = share(y1.netIncome, y1.revenue);
  return (
    <>
      <GuideBlock title="What students practice">
        <p>Percent change, ratios (net margin), and the difference between absolute and relative growth. Question 4 introduces nominal versus real growth.</p>
      </GuideBlock>
      <GuideBlock title="Prep (5 minutes)">
        <p>Download <PackLink slug="nc-public-companies-annual" /> and open it in Google Sheets or Excel. Filter <code>charlotte_region</code> to “yes” if you want local companies only. Each company has several rows, one per fiscal year.</p>
      </GuideBlock>
      <GuideBlock title={`Answer key, Part A (${c.name})`}>
        <Key items={[
          ["Revenue change:", `${money(y1.revenue, 2)} → ${money(y0.revenue, 2)}, ${signedPct(pctChange(y0.revenue, y1.revenue))}`],
          ["Net income change:", `${money(y1.netIncome, 2)} → ${money(y0.netIncome, 2)}, ${signedPct(pctChange(y0.netIncome, y1.netIncome))}`],
          ["Net margin:", `${pct(m1)} → ${pct(m0)}`],
        ]} />
        <p className="text-muted text-sm">Exact dollar figures: revenue {int(y1.revenue)} and {int(y0.revenue)}; net income {int(y1.netIncome)} and {int(y0.netIncome)}. Source: <SourceLink href={c.sources.filings}>{c.name} filings at SEC EDGAR</SourceLink>.</p>
      </GuideBlock>
      <GuideBlock title="Watch for">
        <p>Fiscal years don’t all end in December; compare the <code>fiscal_year_end</code> dates. Banks and insurers (where <code>revenue_is_calculated</code> may be “yes”) define revenue differently, so steer beginners to other industries. A negative net income is a loss, and a percent change from a loss is not meaningful.</p>
      </GuideBlock>
      <GuideBlock title="Discussion">
        <p>Is revenue growth always good news? What would you want to know before calling a company “healthy”: profit, cash flow, debt? (All are in the pack.)</p>
      </GuideBlock>
    </>
  );
}

// ---------- 2. Where does a nonprofit's money come from? ----------

const regionNp = nonprofits.filter((n) => inRegion(n.county) && n.filings[0] && n.filings[0].revenue > 0
  && n.filings[0].contributions != null && n.filings[0].programRevenue != null && n.filings[0].expenses != null);
const donorFunded = regionNp.find((n) => (share(n.filings[0].contributions, n.filings[0].revenue) ?? 0) >= 0.5);
const feeFunded = regionNp.find((n) => (share(n.filings[0].programRevenue, n.filings[0].revenue) ?? 0) >= 0.5);
const npExamples = [donorFunded, feeFunded].filter((n): n is NonNullable<typeof n> => !!n);

function NonprofitStudent() {
  return (
    <>
      <p>Nonprofits don’t have owners or profits, but they still need money. Every large one files IRS Form 990, which shows where its money came from and where it went. Two big sources are <strong>contributions</strong> (donations and grants) and <strong>program revenue</strong> (fees for services, like tuition or patient bills).</p>
      <h3 className="font-semibold mt-4">Part A. Two Charlotte-region nonprofits</h3>
      <p className="text-sm text-muted">From each organization’s latest Form 990.</p>
      <FillTable
        head={["Organization", "Total revenue", "Contributions", "Program revenue", "Expenses", "Contributions ÷ revenue", "Revenue − expenses"]}
        rows={npExamples.map((n) => {
          const f = n.filings[0];
          return [`${n.name} (${f.taxYear})`, money(f.revenue), money(f.contributions), money(f.programRevenue), money(f.expenses), null, null];
        })}
      />
      <h3 className="font-semibold mt-4">Part B. A nonprofit you know</h3>
      <p>Open <PackLink slug="nc-nonprofits-990" />, find an organization you have heard of, and use its latest tax year.</p>
      <FillTable head={["Organization:", "Revenue", "Contributions", "Program revenue", "Expenses", "Officer pay"]} rows={[[null, null, null, null, null, null]]} />
      <ol className="space-y-3 mt-4">
        <Q n={1}>For each organization in Part A, what share of revenue came from donations? Which one depends more on donors?</Q>
        <Q n={2}>Did each organization take in more than it spent (a surplus) or less (a deficit)? Why might a nonprofit want a surplus?</Q>
        <Q n={3}>For your organization, what percent of total expenses went to officer pay? Is that number alone enough to judge whether it is well run? Why or why not?</Q>
        <Q n={4} lines={3}>You have $100 to donate. Name two facts from a Form 990 you would check first, and explain how each would change your decision.</Q>
      </ol>
    </>
  );
}

function NonprofitTeacher() {
  return (
    <>
      <GuideBlock title="What students practice">
        <p>Parts of a whole (shares and percents), surplus and deficit, and reading a real tax form. Fits personal finance units on charitable giving and economics units on the nonprofit sector.</p>
      </GuideBlock>
      <GuideBlock title="Prep (5 minutes)">
        <p>Download <PackLink slug="nc-nonprofits-990" />. Each organization has up to five rows, one per tax year. The <code>filing_pdf</code> column links to the actual return, which is worth projecting for a minute.</p>
      </GuideBlock>
      <GuideBlock title="Answer key, Part A">
        <Key items={npExamples.map((n) => {
          const f = n.filings[0];
          return [`${n.name}, ${f.taxYear}:`, `contributions ${pct(share(f.contributions, f.revenue))} of revenue; program revenue ${pct(share(f.programRevenue, f.revenue))}; revenue − expenses = ${money(f.revenue - (f.expenses ?? 0))}`];
        })} />
        <p className="text-muted text-sm">Sources: {npExamples.map((n, i) => <span key={n.ein}>{i > 0 && " · "}<SourceLink href={n.sources.propublica}>{n.name} on ProPublica</SourceLink></span>)}.</p>
      </GuideBlock>
      <GuideBlock title="Watch for">
        <p>Contributions and program revenue don’t always add up to total revenue; investment income and other sources make up the rest. Hospitals and universities are mostly fee-funded, food banks and foundations mostly donor-funded, so a low donation share is not a red flag on its own. Officer pay as a share of spending is one fact, not a rating.</p>
      </GuideBlock>
      <GuideBlock title="Discussion">
        <p>Should donors care more about how much an organization spends, or about what it achieves? What part of that can a Form 990 show, and what can’t it show?</p>
      </GuideBlock>
    </>
  );
}

// ---------- 3. What does a typical layoff look like? ----------

const warnCounts = warnNotices.map((w) => w.affected);
const warnTotal = warnCounts.reduce((s, n) => s + n, 0);
const warnMean = warnCounts.length ? warnTotal / warnCounts.length : null;
const warnMedian = median(warnCounts);
const warnMax = warnNotices.reduce<(typeof warnNotices)[number] | null>((m, w) => (!m || w.affected > m.affected ? w : m), null);
const warnByCounty = Object.entries(warnNotices.reduce<Record<string, { n: number; workers: number }>>((acc, w) => {
  const k = acc[w.county] ?? { n: 0, workers: 0 };
  acc[w.county] = { n: k.n + 1, workers: k.workers + w.affected };
  return acc;
}, {})).sort((a, b) => b[1].workers - a[1].workers);
const warnClosures = warnNotices.filter((w) => /closure/i.test(w.type)).length;

function WarnStudent() {
  const { year } = privateData.warn;
  return (
    <>
      <p>Under the federal WARN Act, many large employers must give 60 days’ notice before a mass layoff or plant closing. North Carolina publishes every notice it receives. Each row in the data is one notice at one location.</p>
      <p className="mt-2">Open <PackLink slug="nc-warn-layoffs" /> in a spreadsheet. Useful formulas: <code>=COUNT()</code>, <code>=SUM()</code>, <code>=AVERAGE()</code>, <code>=MEDIAN()</code>, <code>=MAX()</code>, <code>=COUNTIF()</code>, <code>=SUMIF()</code>.</p>
      <FillTable head={[`${year} so far`, "Your answer"]} rows={[["Number of notices", null], ["Total workers affected", null], ["Mean workers per notice", null], ["Median workers per notice", null], ["Largest single notice (workers, company)", null]]} />
      <ol className="space-y-3 mt-4">
        <Q n={1}>The mean and the median are different. Which is larger, and what about the data causes that?</Q>
        <Q n={2}>A headline says “The average North Carolina layoff affects ___ workers.” Which number belongs in the blank, the mean or the median? Defend your choice.</Q>
        <Q n={3}>Which county had the most workers affected? Is that the same county with the most notices? Why might they differ?</Q>
        <Q n={4}>What share of notices are closures rather than layoffs?</Q>
        <Q n={5} lines={3}>A WARN notice is a plan filed in advance, not a count of jobs actually lost. Name one reason the real number could end up higher or lower.</Q>
      </ol>
    </>
  );
}

function WarnTeacher() {
  const { year, sourcePage } = privateData.warn;
  const top = warnByCounty[0];
  const mostNotices = [...warnByCounty].sort((a, b) => b[1].n - a[1].n)[0];
  return (
    <>
      <GuideBlock title="What students practice">
        <p>Measures of center in skewed data (mean versus median), grouping and counting, and judging which statistic fits a claim. Fits statistics units and economics units on unemployment and the labor market.</p>
      </GuideBlock>
      <GuideBlock title="Prep (5 minutes)">
        <p>Download <PackLink slug="nc-warn-layoffs" />. If students are new to spreadsheets, demo <code>=MEDIAN(I:I)</code> on the <code>workers_affected</code> column first.</p>
      </GuideBlock>
      <GuideBlock title={`Answer key (data as of ${date(privateData.generatedAt)})`}>
        <Key items={[
          ["Notices:", int(warnCounts.length)],
          ["Workers affected:", int(warnTotal)],
          ["Mean per notice:", warnMean == null ? "—" : warnMean.toFixed(1)],
          ["Median per notice:", warnMedian == null ? "—" : String(warnMedian)],
          ["Largest notice:", warnMax ? `${int(warnMax.affected)} workers, ${warnMax.company} (${warnMax.county} County)` : "—"],
          ["County with most workers affected:", top ? `${top[0]} (${int(top[1].workers)} workers, ${top[1].n} notices)` : "—"],
          ["County with most notices:", mostNotices ? `${mostNotices[0]} (${mostNotices[1].n} notices)` : "—"],
          ["Closures:", `${int(warnClosures)} of ${int(warnCounts.length)} notices (${pct(share(warnClosures, warnCounts.length))})`],
        ]} />
        <p className="text-muted text-sm">The mean is pulled up by a few very large notices; the median is the better “typical” value. These answers update when the data refreshes, so reprint the guide with the CSV. Source: <SourceLink href={sourcePage}>NC Department of Commerce WARN reports</SourceLink>.</p>
      </GuideBlock>
      <GuideBlock title="Watch for">
        <p>Students may sum the notice count instead of the workers column. Smaller employers are not required to file, so this is not every job lost in the state in {year}.</p>
      </GuideBlock>
    </>
  );
}

// ---------- 4. Following federal dollars ----------

const { completed, prior } = privateData.fiscalYears;
function countyStats(county: string) {
  const list = privateData.localContractors[county] ?? [];
  const amounts = list.map((c) => (c[completed] as number) ?? 0);
  const total = amounts.reduce((s, n) => s + n, 0);
  const top5 = amounts.slice(0, 5).reduce((s, n) => s + n, 0);
  return { list, total, top1: list[0], top1Share: share(amounts[0], total), top5Share: share(top5, total), newCount: list.filter((c) => c[prior] == null).length };
}

function FederalStudent() {
  return (
    <>
      <p>The federal government buys billions of dollars of goods and services from private companies, and every contract is public on USAspending.gov. Read the explainer <Link href="/federal-money" className="text-accent underline underline-offset-2">Where federal contract money goes in your county</Link> first.</p>
      <p className="mt-2">Open <PackLink slug="nc-federal-contractors" /> and filter the <code>scope</code> column to one county at a time.</p>
      <FillTable head={[`${completed}`, "Mecklenburg (top 25)", "Union (top 25)"]} rows={[["Total for the top 25", null, null], ["Largest recipient and its amount", null, null], ["Largest recipient’s share of the top-25 total", null, null], ["Top 5’s share of the top-25 total", null, null]]} />
      <ol className="space-y-3 mt-4">
        <Q n={1}>In which county is the money more concentrated in a single company? What risk does that create for that county’s economy?</Q>
        <Q n={2}>Find a contractor whose dollars changed a lot from {prior} to {completed}. Open its source_url. Which agency paid it, and for what?</Q>
        <Q n={3}>The county is based on the contractor’s address, not where the work happens. Give one example of how that could make a county look bigger or smaller than it really is.</Q>
        <Q n={4} lines={3}>Using <PackLink slug="nc-new-federal-awards" />, which federal department awarded the most new contracts in North Carolina in the last 60 days? Why might that department buy so much here?</Q>
      </ol>
    </>
  );
}

function FederalTeacher() {
  const m = countyStats("Mecklenburg"), u = countyStats("Union");
  const agencies = Object.entries(privateData.newAwards.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.agency]: (acc[a.agency] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <GuideBlock title="What students practice">
        <p>Shares and concentration, year-over-year change, and reading a government record. Fits economics units on government spending and civics units on public accountability.</p>
      </GuideBlock>
      <GuideBlock title="Prep (5 minutes)">
        <p>Download <PackLink slug="nc-federal-contractors" /> and <PackLink slug="nc-new-federal-awards" />. Assign the <Link href="/federal-money" className="text-accent underline underline-offset-2">explainer</Link> as a short reading first; it defines obligation, fiscal year and recipient location.</p>
      </GuideBlock>
      <GuideBlock title={`Answer key (${completed}, data as of ${date(privateData.generatedAt)})`}>
        <Key items={[
          ["Mecklenburg top-25 total:", money(m.total)],
          ["Mecklenburg largest:", m.top1 ? `${m.top1.name}, ${money(m.top1[completed] as number)} (${pct(m.top1Share)} of the top 25)` : "—"],
          ["Mecklenburg top 5 share:", pct(m.top5Share)],
          ["Union top-25 total:", money(u.total)],
          ["Union largest:", u.top1 ? `${u.top1.name}, ${money(u.top1[completed] as number)} (${pct(u.top1Share)} of the top 25)` : "—"],
          ["Union top 5 share:", pct(u.top5Share)],
          ["Most new awards (last 60 days):", agencies[0] ? `${agencies[0][0]}, ${agencies[0][1]} of ${privateData.newAwards.length}` : "—"],
        ]} />
        <p className="text-muted text-sm">Source: <SourceLink href="https://www.usaspending.gov/search">USAspending.gov</SourceLink>. Each row in the CSV links to the recipient’s profile.</p>
      </GuideBlock>
      <GuideBlock title="Watch for">
        <p>The top-25 total is not the county’s total; smaller contractors are not included. Obligations are commitments and can be revised later, so a recipient’s figures can change after the fact.</p>
      </GuideBlock>
    </>
  );
}

export const worksheets: Worksheet[] = [
  { slug: "is-this-company-growing", title: "Is this company growing?", question: "Use real SEC filings to measure revenue and profit growth.", subjects: ["Economics", "Statistics", "Personal finance"], minutes: 45, packs: ["nc-public-companies-annual"], Student: GrowthStudent, Teacher: GrowthTeacher },
  { slug: "where-nonprofit-money-comes-from", title: "Where does a nonprofit’s money come from?", question: "Read Form 990 data to see who pays for a charity, and what to check before you give.", subjects: ["Personal finance", "Economics"], minutes: 45, packs: ["nc-nonprofits-990"], Student: NonprofitStudent, Teacher: NonprofitTeacher },
  { slug: "what-a-typical-layoff-looks-like", title: "What does a typical layoff look like?", question: "Mean versus median, with every layoff notice filed in North Carolina this year.", subjects: ["Statistics", "Economics"], minutes: 45, packs: ["nc-warn-layoffs"], Student: WarnStudent, Teacher: WarnTeacher },
  { slug: "following-federal-dollars", title: "Following federal dollars", question: "Who in Mecklenburg and Union counties gets federal contracts, and how concentrated is it?", subjects: ["Economics", "Civics"], minutes: 50, packs: ["nc-federal-contractors", "nc-new-federal-awards"], Student: FederalStudent, Teacher: FederalTeacher },
];

export const getWorksheet = (slug: string) => worksheets.find((w) => w.slug === slug);
