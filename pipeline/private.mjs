// Private-company stage: the public dollar figures that exist for private NC businesses.
//  - Federal contract obligations to NC-located recipients (USAspending.gov API), this FY vs last FY
//  - Largest new NC federal contract awards in the last 60 days
//  - NC WARN layoff/closure notices for the current year (NC Commerce CSV)
//   node pipeline/private.mjs [--warn-url <csv url>]  -> writes site/data/private.json
// The WARN CSV URL changes each month; the monthly task passes the current one with --warn-url.
import { cachedFetch, parseCsv, writeData, titleCase } from './lib.mjs';

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const WARN_URL = arg('--warn-url')
  || 'https://files.nc.gov/commerce/2026-11/warn%20summary%20report%20111126.csv?VersionId=u2xUi_nl5S4QRbE6FdUJcMDSnyE2Lche';

const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
// Federal fiscal year starts Oct 1.
const fyStartYear = today.getUTCMonth() >= 9 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
const FY = (y) => ({ label: `FY${y + 1}`, start: `${y}-10-01`, end: `${y + 1}-09-30` });
const curFY = FY(fyStartYear), prevFY = FY(fyStartYear - 1), prevFY2 = FY(fyStartYear - 2);
const CONTRACTS = ['A', 'B', 'C', 'D'];
const NC = [{ country: 'USA', state: 'NC' }];

async function topRecipients(fy, limit = 100, locations = NC, tag = 'NC') {
  const body = { filters: { time_period: [{ start_date: fy.start, end_date: fy.end }], recipient_locations: locations, award_type_codes: CONTRACTS }, limit, page: 1 };
  const key = tag === 'NC' ? `usaspending/recipients-${fy.label}.json` : `usaspending/recipients-${tag}-${fy.label}.json`;
  const res = await cachedFetch('https://api.usaspending.gov/api/v2/search/spending_by_category/recipient/', key, { method: 'POST', body, gapMs: 1000 });
  return res?.results ?? [];
}

// Completed fiscal years are the stable comparison; the current FY is year-to-date.
const [ytd, last, prior] = await Promise.all([topRecipients(curFY), topRecipients(prevFY), topRecipients(prevFY2)]);
const byId = (rows) => Object.fromEntries(rows.map((r) => [r.recipient_id, r.amount]));
const lastMap = byId(last), priorMap = byId(prior), ytdMap = byId(ytd);
const contractors = last.map((r) => ({
  name: titleCase(r.name),
  recipientId: r.recipient_id,
  uei: r.uei || null,
  [prevFY.label]: r.amount,
  [prevFY2.label]: priorMap[r.recipient_id] ?? null,
  [`${curFY.label}ytd`]: ytdMap[r.recipient_id] ?? null,
  growth: priorMap[r.recipient_id] ? (r.amount - priorMap[r.recipient_id]) / Math.abs(priorMap[r.recipient_id]) : null,
  source: `https://www.usaspending.gov/recipient/${r.recipient_id}/latest`,
}));
console.log(`USAspending: ${contractors.length} top NC contract recipients for ${prevFY.label}`);

const since = new Date(today.getTime() - 60 * 864e5);
const awardBody = {
  filters: { time_period: [{ start_date: iso(since), end_date: iso(today) }], recipient_locations: NC, award_type_codes: CONTRACTS },
  fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Start Date', 'Description', 'generated_internal_id'],
  sort: 'Award Amount', order: 'desc', limit: 100, page: 1,
};
const awardsRes = await cachedFetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', `usaspending/awards-${iso(today).slice(0, 7)}.json`, { method: 'POST', body: awardBody, gapMs: 1000 });
const newAwards = (awardsRes?.results ?? [])
  .filter((a) => a['Start Date'] && a['Start Date'] >= iso(since)) // genuinely new, not old awards with new actions
  .slice(0, 25)
  .map((a) => ({
    recipient: titleCase(a['Recipient Name']), amount: a['Award Amount'], agency: a['Awarding Agency'],
    startDate: a['Start Date'], description: a.Description, awardId: a['Award ID'],
    source: `https://www.usaspending.gov/award/${a.generated_internal_id}`,
  }));
console.log(`USAspending: ${newAwards.length} new NC contract awards since ${iso(since)}`);

// Charlotte core counties: top contract recipients located in Mecklenburg and Union (county FIPS).
const LOCAL = { Mecklenburg: '119', Union: '179' };
const local = {};
for (const [county, fips] of Object.entries(LOCAL)) {
  const loc = [{ country: 'USA', state: 'NC', county: fips }];
  const [cur, prev] = await Promise.all([topRecipients(prevFY, 25, loc, county), topRecipients(prevFY2, 100, loc, county)]);
  const prevMap = byId(prev);
  local[county] = cur.map((r) => ({
    name: titleCase(r.name), recipientId: r.recipient_id,
    [prevFY.label]: r.amount, [prevFY2.label]: prevMap[r.recipient_id] ?? null,
    growth: prevMap[r.recipient_id] ? (r.amount - prevMap[r.recipient_id]) / Math.abs(prevMap[r.recipient_id]) : null,
    source: `https://www.usaspending.gov/recipient/${r.recipient_id}/latest`,
  }));
}
console.log(`USAspending: local contractors ${Object.entries(local).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);

const warnCsv = await cachedFetch(WARN_URL, `warn/warn-${today.getUTCFullYear()}.csv`, { json: false, days: 7 });
const warn = parseCsv(warnCsv).map((r) => ({
  company: r['WARN Notice: WARN Notice Name'],
  county: r.County.replace(/ County$/, ''),
  city: r.City || null,
  noticeNumber: r['Warn Number'],
  noticeDate: r['Date of Notice'],
  effectiveDate: r['Effective Date'],
  type: r['WARN notice type'],
  permanence: r['Type of layoff or closure'],
  affected: Number(r['Number affected at this location']) || 0,
}));
const warnTotals = { notices: warn.length, workersAffected: warn.reduce((s, w) => s + w.affected, 0) };
console.log(`WARN: ${warnTotals.notices} notices, ${warnTotals.workersAffected} workers affected`);

await writeData('private.json', {
  source: 'USAspending.gov API; NC Department of Commerce WARN summary list',
  fiscalYears: { completed: prevFY.label, prior: prevFY2.label, current: curFY.label },
  contractors,
  localContractors: local,
  newAwards,
  warn: { year: today.getUTCFullYear(), sourceCsv: WARN_URL, sourcePage: 'https://www.commerce.nc.gov/data-tools-reports/labor-market-data-tools/workforce-warn-reports', totals: warnTotals, notices: warn },
});
