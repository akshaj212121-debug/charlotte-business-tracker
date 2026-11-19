// "What changed" stage. Run after the other three stages.
//   node pipeline/snapshot.mjs          -> writes site/data/history/<YYYY-MM>.json (compact snapshot of this run)
//                                          and site/data/changes/<YYYY-MM>.json (diff vs the latest earlier month)
//   node pipeline/snapshot.mjs --test   -> self-test of the diff
// Re-running in the same month overwrites that month's snapshot and diff. The first month is a baseline.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const DATA = new URL('../site/data/', import.meta.url);
const readJson = async (name) => JSON.parse(await fs.readFile(new URL(name, DATA), 'utf8'));

export function buildSnapshot(month, { companies }, { organizations }, priv) {
  const fy = priv.fiscalYears.completed;
  return {
    month,
    generatedAt: new Date().toISOString(),
    companies: Object.fromEntries(companies.map((c) => [c.cik, {
      name: c.name, county: c.county,
      fyEnd: c.years[0]?.end ?? null, revenue: c.years[0]?.revenue ?? null, netIncome: c.years[0]?.netIncome ?? null,
      qEnd: c.latestQuarter?.end ?? null, qLabel: c.latestQuarter?.label ?? null,
      qRevenue: c.latestQuarter?.revenue ?? null, qRevenueGrowth: c.latestQuarter?.revenueGrowth ?? null, qNetIncome: c.latestQuarter?.netIncome ?? null,
    }])),
    signals: Object.fromEntries(companies.flatMap((c) => c.signals.map((f) => [f.url, {
      cik: c.cik, name: c.name, date: f.date, form: f.form,
      items: f.items.filter((i) => ['1.03', '2.05', '2.06', '3.01', '4.02'].includes(i.code)).map((i) => i.label),
    }]))),
    nonprofits: Object.fromEntries(organizations.map((n) => [n.ein, {
      name: n.name, county: n.county, taxYear: n.filings[0]?.taxYear ?? null, revenue: n.filings[0]?.revenue ?? null,
      rankStatewide: n.rankStatewide ?? null,
    }])),
    contractorsFY: fy,
    contractors: Object.fromEntries(priv.contractors.map((c) => [c.recipientId, { name: c.name, amount: c[fy] }])),
    warn: Object.fromEntries(priv.warn.notices.map((w) => [`${priv.warn.year}-${w.noticeNumber}`, {
      company: w.company, county: w.county, city: w.city, affected: w.affected, noticeDate: w.noticeDate, effectiveDate: w.effectiveDate, type: w.type,
    }])),
    awards: Object.fromEntries(priv.newAwards.map((a) => [a.awardId, { recipient: a.recipient, amount: a.amount, agency: a.agency, startDate: a.startDate, source: a.source }])),
  };
}

const added = (cur, prev) => Object.entries(cur).filter(([k]) => !(k in prev)).map(([k, v]) => ({ id: k, ...v }));

export function diffSnapshots(prev, cur) {
  if (!prev) return { month: cur.month, previousMonth: null, baseline: true };
  const sameFY = prev.contractorsFY === cur.contractorsFY;
  const byAmount = (a, b) => (b.amount ?? 0) - (a.amount ?? 0);
  const changes = {
    month: cur.month,
    previousMonth: prev.month,
    baseline: false,
    companiesAdded: added(cur.companies, prev.companies),
    companiesRemoved: added(prev.companies, cur.companies),
    newAnnualReports: Object.entries(cur.companies)
      .filter(([k, c]) => prev.companies[k] && c.fyEnd && c.fyEnd !== prev.companies[k].fyEnd)
      .map(([k, c]) => ({ id: k, ...c, prevFyEnd: prev.companies[k].fyEnd })),
    newQuarterlyReports: Object.entries(cur.companies)
      .filter(([k, c]) => prev.companies[k] && c.qEnd && c.qEnd !== prev.companies[k].qEnd)
      .map(([k, c]) => ({ id: k, ...c }))
      .sort((a, b) => (b.qRevenue ?? 0) - (a.qRevenue ?? 0)),
    newSignals: added(cur.signals, prev.signals).sort((a, b) => b.date.localeCompare(a.date)),
    newWarn: added(cur.warn, prev.warn).sort((a, b) => b.affected - a.affected),
    contractorFYChanged: !sameFY,
    contractorsEntered: sameFY ? added(cur.contractors, prev.contractors).sort(byAmount) : [],
    contractorsExited: sameFY ? added(prev.contractors, cur.contractors).sort(byAmount) : [],
    nonprofitNew990s: Object.entries(cur.nonprofits)
      .filter(([k, n]) => prev.nonprofits[k] && n.taxYear && n.taxYear !== prev.nonprofits[k].taxYear)
      .map(([k, n]) => ({ id: k, ...n, prevTaxYear: prev.nonprofits[k].taxYear })),
    newAwards: added(cur.awards, prev.awards).sort(byAmount),
  };
  changes.newWarnWorkers = changes.newWarn.reduce((s, w) => s + w.affected, 0);
  return changes;
}

async function main() {
  const month = new Date().toISOString().slice(0, 7);
  const [pub, np, priv] = await Promise.all([readJson('public-companies.json'), readJson('nonprofits.json'), readJson('private.json')]);
  const snap = buildSnapshot(month, pub, np, priv);
  const histDir = new URL('history/', DATA), chgDir = new URL('changes/', DATA);
  await fs.mkdir(histDir, { recursive: true });
  await fs.mkdir(chgDir, { recursive: true });
  const earlier = (await fs.readdir(histDir)).filter((f) => /^\d{4}-\d{2}\.json$/.test(f) && f < `${month}.json`).sort();
  const prev = earlier.length ? JSON.parse(await fs.readFile(new URL(earlier.at(-1), histDir), 'utf8')) : null;
  await fs.writeFile(new URL(`${month}.json`, histDir), JSON.stringify(snap));
  const changes = diffSnapshots(prev, snap);
  await fs.writeFile(new URL(`${month}.json`, chgDir), JSON.stringify(changes, null, 1));
  if (changes.baseline) console.log(`Snapshot ${month} saved as the baseline (no earlier month to compare).`);
  else console.log(`Changes ${prev.month} -> ${month}: ${changes.newWarn.length} new WARN notices, ${changes.newSignals.length} new distress filings, ${changes.newAnnualReports.length} new 10-Ks, ${changes.newQuarterlyReports.length} new quarters, ${changes.companiesAdded.length} companies added / ${changes.companiesRemoved.length} removed`);
}

function selfTest() {
  const base = (over = {}) => ({ month: '2026-11', companies: {}, signals: {}, nonprofits: {}, contractorsFY: 'FY2026', contractors: {}, warn: {}, awards: {}, ...over });
  const prev = base({
    companies: { 1: { name: 'A', fyEnd: '2025-12-31', qEnd: '2026-06-30' }, 2: { name: 'B', fyEnd: '2025-12-31' } },
    warn: { 'w1': { company: 'X', affected: 50 } },
    contractors: { r1: { name: 'C1', amount: 10 } },
  });
  const cur = base({
    month: '2026-12',
    companies: { 1: { name: 'A', fyEnd: '2025-12-31', qEnd: '2026-09-30', qRevenue: 5 }, 3: { name: 'C', fyEnd: '2026-06-30' } },
    warn: { 'w1': { company: 'X', affected: 50 }, 'w2': { company: 'Y', affected: 120 }, 'w3': { company: 'Z', affected: 30 } },
    contractors: { r2: { name: 'C2', amount: 20 } },
  });
  const d = diffSnapshots(prev, cur);
  assert.deepEqual(d.companiesAdded.map((c) => c.id), ['3']);
  assert.deepEqual(d.companiesRemoved.map((c) => c.id), ['2']);
  assert.deepEqual(d.newQuarterlyReports.map((c) => c.id), ['1']);
  assert.equal(d.newAnnualReports.length, 0);
  assert.deepEqual(d.newWarn.map((w) => w.company), ['Y', 'Z'], 'largest first');
  assert.equal(d.newWarnWorkers, 150);
  assert.equal(d.contractorsEntered[0].name, 'C2');
  assert.equal(d.contractorsExited[0].name, 'C1');
  const fyRoll = diffSnapshots(prev, { ...cur, contractorsFY: 'FY2027' });
  assert.equal(fyRoll.contractorFYChanged, true);
  assert.equal(fyRoll.contractorsEntered.length, 0, 'no enter/exit across a fiscal-year rollover');
  assert.equal(diffSnapshots(null, cur).baseline, true);
  console.log('snapshot.mjs self-test passed');
}

if (process.argv.includes('--test')) selfTest();
else await main();
