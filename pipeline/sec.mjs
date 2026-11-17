// SEC EDGAR stage: finds every SEC registrant headquartered in North Carolina and extracts
// five years of annual financials plus recent filings / distress signals.
//   node pipeline/sec.mjs          -> writes site/data/public-companies.json
//   node pipeline/sec.mjs --test   -> runs the extraction self-check only
// Uses only data.sec.gov (official JSON APIs). Optional SEC_USER_AGENT in charlotte-tracker/.env
// (SEC asks for a contact in the User-Agent); falls back to a generic tool name.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { displayName } from './lib.mjs';

try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch {}
const UA = process.env.SEC_USER_AGENT || 'CharlotteBusinessTracker/1.0 (public-records research)';
const CACHE = new URL('./.cache/sec/', import.meta.url);
const OUT = new URL('../site/data/public-companies.json', import.meta.url);
const CACHE_DAYS = 25; // monthly refresh re-fetches everything older than this

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let nextSlot = 0;
async function throttle() { // <= 8 requests/second, under SEC's 10/s limit
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 125;
  if (wait) await sleep(wait);
}

async function getJson(url, cacheKey) {
  const file = new URL(cacheKey, CACHE);
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs < CACHE_DAYS * 864e5) return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  for (let attempt = 0; attempt < 4; attempt++) {
    await throttle();
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
    if (res.status === 404) return null;
    if (res.ok) {
      const text = await res.text();
      await fs.mkdir(new URL('.', file), { recursive: true });
      await fs.writeFile(file, text);
      return JSON.parse(text);
    }
    await sleep(2000 * (attempt + 1)); // 429/5xx: back off
  }
  throw new Error(`SEC fetch failed: ${url}`);
}

const pad = (cik) => String(cik).padStart(10, '0');

// ---------- financial extraction ----------
const CONCEPTS = {
  revenue: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet', 'RevenuesNetOfInterestExpense', 'GrossInvestmentIncomeOperating'],
  netInterestIncome: ['InterestIncomeExpenseNet'], // banks: revenue = net interest income + noninterest income
  noninterestIncome: ['NoninterestIncome'],
  operatingIncome: ['OperatingIncomeLoss'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
  epsDiluted: ['EarningsPerShareDiluted'],
  dividendsPerShare: ['CommonStockDividendsPerShareDeclared'],
  assets: ['Assets'],
  liabilities: ['Liabilities'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  longTermDebt: ['LongTermDebtNoncurrent', 'LongTermDebt'],
};
const INSTANT = new Set(['assets', 'liabilities', 'equity', 'cash', 'longTermDebt']);
const ANNUAL_FORMS = /^(10-K|20-F|40-F)/;

// Returns { 'YYYY-MM-DD' (fiscal year end): value } for one metric, preferring earlier concepts
// in the list and, within a concept, the most recently filed (i.e. restated) value.
export function annualSeries(gaap, metric) {
  const out = {};
  for (const concept of CONCEPTS[metric]) {
    const units = gaap?.[concept]?.units;
    if (!units) continue;
    const facts = units.USD ?? units['USD/shares'] ?? [];
    const best = {};
    for (const f of facts) {
      if (!ANNUAL_FORMS.test(f.form ?? '')) continue;
      if (INSTANT.has(metric)) {
        if (f.start) continue;
      } else {
        if (!f.start) continue;
        const days = (Date.parse(f.end) - Date.parse(f.start)) / 864e5;
        if (days < 350 || days > 380) continue;
      }
      if (!best[f.end] || f.filed > best[f.end].filed) best[f.end] = f;
    }
    for (const [end, f] of Object.entries(best)) if (!(end in out)) out[end] = f.val;
  }
  return out;
}

const ratio = (a, b) => (a == null || b == null || b === 0 ? null : a / b);

export function buildFinancials(facts) {
  const gaap = facts?.facts?.['us-gaap'];
  if (!gaap) return { years: [], derived: null };
  const series = Object.fromEntries(Object.keys(CONCEPTS).map((m) => [m, annualSeries(gaap, m)]));
  // Banks rarely tag a single revenue line; their conventional total revenue is net interest
  // income + noninterest income. Filled only where no reported revenue exists, and flagged.
  const revenueCalc = {};
  for (const [end, nii] of Object.entries(series.netInterestIncome)) {
    const non = series.noninterestIncome[end];
    if (series.revenue[end] == null && non != null) { series.revenue[end] = nii + non; revenueCalc[end] = true; }
  }
  // Fiscal years = period ends that carry a flow metric (revenue or net income).
  const ends = [...new Set([...Object.keys(series.revenue), ...Object.keys(series.netIncome)])]
    .sort().reverse().slice(0, 5);
  const years = ends.map((end) => {
    const row = { end, revenueCalc: Boolean(revenueCalc[end]) };
    for (const m of Object.keys(CONCEPTS)) row[m] = series[m][end] ?? null;
    row.freeCashFlow = row.operatingCashFlow != null && row.capex != null ? row.operatingCashFlow - row.capex : null;
    return row;
  });
  const [cur, prev] = years;
  const derived = cur ? {
    revenueGrowth: prev ? ratio(cur.revenue - prev.revenue, Math.abs(prev.revenue ?? 0) || null) : null,
    netIncomeGrowth: prev && prev.netIncome ? ratio(cur.netIncome - prev.netIncome, Math.abs(prev.netIncome)) : null,
    netMargin: ratio(cur.netIncome, cur.revenue),
    operatingMargin: ratio(cur.operatingIncome, cur.revenue),
    returnOnEquity: ratio(cur.netIncome, cur.equity),
    returnOnAssets: ratio(cur.netIncome, cur.assets),
    liabilitiesToEquity: ratio(cur.liabilities, cur.equity),
    fcfMargin: ratio(cur.freeCashFlow, cur.revenue),
  } : null;
  return { years, derived };
}

// ---------- filings / signals ----------
const ITEM_LABELS = {
  '1.01': 'Entered material agreement', '1.02': 'Terminated material agreement', '1.03': 'Bankruptcy or receivership',
  '2.01': 'Completed acquisition or sale of assets', '2.02': 'Results of operations', '2.03': 'New debt obligation',
  '2.05': 'Exit or restructuring costs', '2.06': 'Asset impairment', '3.01': 'Delisting notice',
  '3.02': 'Unregistered sale of equity', '3.03': 'Change to shareholder rights',
  '4.01': 'Auditor change', '4.02': 'Prior financials no longer reliable', '5.01': 'Change in control', '5.02': 'Executive or director change', '5.03': 'Charter or bylaw amendment',
  '5.07': 'Shareholder vote results', '7.01': 'Regulation FD disclosure', '8.01': 'Other events',
};
const DISTRESS_ITEMS = new Set(['1.03', '2.05', '2.06', '3.01', '4.02']);
const KEEP_FORMS = new Set(['10-K', '10-K/A', '10-Q', '8-K', '8-K/A', 'DEF 14A', '20-F', 'S-1', '15-12G', '25-NSE']);

function recentFilings(sub, sinceIso) {
  const r = sub?.filings?.recent;
  if (!r) return [];
  const out = [];
  for (let i = 0; i < r.form.length; i++) {
    if (r.filingDate[i] < sinceIso) break; // newest first
    if (!KEEP_FORMS.has(r.form[i])) continue;
    const items = (r.items[i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    out.push({
      form: r.form[i],
      date: r.filingDate[i],
      items: items.map((code) => ({ code, label: ITEM_LABELS[code] ?? `Item ${code}` })).filter((x) => x.code !== '9.01'),
      url: `https://www.sec.gov/Archives/edgar/data/${Number(sub.cik)}/${r.accessionNumber[i].replace(/-/g, '')}/${r.primaryDocument[i]}`,
      // A delisting (3.01) filed alongside a change in control (5.01) is an acquisition closing, not distress.
      distress: items.some((c) => DISTRESS_ITEMS.has(c) && !(c === '3.01' && items.includes('5.01'))),
    });
  }
  return out;
}

// ---------- main ----------
async function main() {
  // Universe: every company that reported total assets in recent XBRL frames (data.sec.gov),
  // then keep those whose business address is in North Carolina.
  const frames = ['CY2026Q2I', 'CY2025Q4I', 'CY2025Q2I'];
  const ciks = new Set();
  for (const f of frames) {
    const frame = await getJson(`https://data.sec.gov/api/xbrl/frames/us-gaap/Assets/USD/${f}.json`, `frame-${f}.json`);
    for (const d of frame?.data ?? []) ciks.add(d.cik);
  }
  console.log(`Universe: ${ciks.size} XBRL filers. Checking headquarters state...`);

  const list = [...ciks];
  const nc = [];
  let done = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (list.length) {
      const cik = list.pop();
      const sub = await getJson(`https://data.sec.gov/submissions/CIK${pad(cik)}.json`, `sub-${cik}.json`).catch(() => null);
      if (sub?.addresses?.business?.stateOrCountry === 'NC') nc.push(sub);
      if (++done % 500 === 0) console.log(`  ${done}/${ciks.size} checked, ${nc.length} in NC`);
    }
  }));
  console.log(`NC registrants: ${nc.length}. Pulling financials...`);

  const since = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
  const companies = [];
  for (const sub of nc) {
    const facts = await getJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad(sub.cik)}.json`, `facts-${Number(sub.cik)}.json`).catch(() => null);
    const { years, derived } = buildFinancials(facts);
    const filings = recentFilings(sub, since);
    const b = sub.addresses.business;
    companies.push({
      cik: Number(sub.cik),
      name: displayName(sub.name),
      legalName: sub.name,
      tickers: sub.tickers ?? [],
      exchanges: sub.exchanges ?? [],
      sic: sub.sic,
      industry: sub.sicDescription,
      city: (b.city || '').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w/g, (c) => c.toLowerCase()),
      state: b.stateOrCountry,
      fiscalYearEnd: sub.fiscalYearEnd,
      filerCategory: sub.category,
      website: sub.website || null,
      formerNames: (sub.formerNames ?? []).map((f) => f.name),
      years,
      derived,
      filings,
      signals: filings.filter((f) => f.distress),
      sources: {
        filings: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${pad(sub.cik)}`,
        xbrl: `https://data.sec.gov/api/xbrl/companyfacts/CIK${pad(sub.cik)}.json`,
      },
    });
  }
  companies.sort((a, b) => (b.years[0]?.revenue ?? -1) - (a.years[0]?.revenue ?? -1));
  await fs.mkdir(new URL('.', OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), source: 'SEC EDGAR (data.sec.gov)', companies }, null, 1));
  const withFin = companies.filter((c) => c.years.length).length;
  console.log(`Wrote ${companies.length} NC companies (${withFin} with XBRL financials) to site/data/public-companies.json`);
}

function selfTest() {
  const fact = (val, start, end, filed, form = '10-K') => ({ val, start, end, filed, form });
  const gaap = {
    Revenues: { units: { USD: [
      fact(100, '2023-01-01', '2023-12-31', '2024-02-01'),
      fact(105, '2023-01-01', '2023-12-31', '2025-02-01'), // restated in later 10-K wins
      fact(30, '2024-07-01', '2024-09-30', '2024-11-01', '10-Q'), // quarterly: ignored
      fact(120, '2024-01-01', '2024-12-31', '2025-02-01'),
    ] } },
    NetIncomeLoss: { units: { USD: [fact(12, '2024-01-01', '2024-12-31', '2025-02-01'), fact(10, '2023-01-01', '2023-12-31', '2024-02-01')] } },
    Assets: { units: { USD: [{ val: 500, end: '2024-12-31', filed: '2025-02-01', form: '10-K' }] } },
    StockholdersEquity: { units: { USD: [{ val: 200, end: '2024-12-31', filed: '2025-02-01', form: '10-K' }] } },
  };
  const { years, derived } = buildFinancials({ facts: { 'us-gaap': gaap } });
  assert.equal(years.length, 2);
  assert.equal(years[0].end, '2024-12-31');
  assert.equal(years[1].revenue, 105, 'restated value should win');
  assert.equal(years[0].assets, 500);
  assert.ok(Math.abs(derived.revenueGrowth - 15 / 105) < 1e-9);
  assert.equal(derived.netMargin, 0.1);
  assert.equal(derived.returnOnEquity, 0.06);
  assert.equal(buildFinancials(null).years.length, 0);
  // Bank: no revenue tag, so net interest income + noninterest income, flagged as calculated.
  const bank = buildFinancials({ facts: { 'us-gaap': {
    InterestIncomeExpenseNet: { units: { USD: [fact(70, '2024-01-01', '2024-12-31', '2025-02-01')] } },
    NoninterestIncome: { units: { USD: [fact(30, '2024-01-01', '2024-12-31', '2025-02-01')] } },
    NetIncomeLoss: { units: { USD: [fact(25, '2024-01-01', '2024-12-31', '2025-02-01')] } },
  } } });
  assert.equal(bank.years[0].revenue, 100);
  assert.equal(bank.years[0].revenueCalc, true);
  assert.equal(years[0].revenueCalc, false);
  console.log('sec.mjs self-test passed');
}

if (process.argv.includes('--test')) selfTest();
else await main();
