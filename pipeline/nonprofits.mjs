// Nonprofit stage: the largest NC tax-exempt organizations by revenue (IRS Exempt Organizations
// Business Master File), with multi-year Form 990 financials from ProPublica Nonprofit Explorer.
//   node pipeline/nonprofits.mjs [--top 100]  -> writes site/data/nonprofits.json
import { cachedFetch, parseCsv, writeData, titleCase } from './lib.mjs';
import { countyResolver, REGION_NAMES } from './geo.mjs';

const TOP = Number(process.argv[process.argv.indexOf('--top') + 1]) || 100;
const REGION_TOP = 25; // largest nonprofits in the Charlotte region's 8 NC counties

const NTEE = {
  A: 'Arts & culture', B: 'Education', C: 'Environment', D: 'Animals', E: 'Health care', F: 'Mental health',
  G: 'Disease & disorders', H: 'Medical research', I: 'Crime & legal', J: 'Employment', K: 'Food & agriculture',
  L: 'Housing', M: 'Public safety', N: 'Recreation & sports', O: 'Youth development', P: 'Human services',
  Q: 'International', R: 'Civil rights', S: 'Community improvement', T: 'Philanthropy & grantmaking',
  U: 'Science & technology', V: 'Social science', W: 'Public benefit', X: 'Religion', Y: 'Mutual & membership benefit', Z: 'Unclassified',
};
const SUBSECTION = { '03': '501(c)(3) charity', '04': '501(c)(4) social welfare', '05': '501(c)(5) labor/agricultural', '06': '501(c)(6) business league', '07': '501(c)(7) social club', '12': '501(c)(12) cooperative', '14': '501(c)(14) credit union' };

const num = (v) => (v === '' || v == null ? null : Number(v));
const ratio = (a, b) => (a == null || b == null || b === 0 ? null : a / b);

const csv = await cachedFetch('https://www.irs.gov/pub/irs-soi/eo_nc.csv', 'irs/eo_nc.csv', { json: false });
const bmf = parseCsv(csv).filter((r) => r.STATE === 'NC' && num(r.REVENUE_AMT) > 0);
bmf.sort((a, b) => num(b.REVENUE_AMT) - num(a.REVENUE_AMT));
const resolveCounty = await countyResolver();
for (const r of bmf) r.geo = resolveCounty(r.ZIP, r.CITY);
const statewide = bmf.slice(0, TOP);
const regional = bmf.filter((r) => REGION_NAMES.has(r.geo?.county)).slice(0, REGION_TOP);
const rankState = new Map(statewide.map((r, i) => [r.EIN, i + 1]));
const rankRegion = new Map(regional.map((r, i) => [r.EIN, i + 1]));
const toProfile = [...statewide, ...regional.filter((r) => !rankState.has(r.EIN))];
console.log(`IRS BMF: ${bmf.length} NC exempt orgs with reported revenue; profiling top ${TOP} statewide + ${toProfile.length - TOP} more from the Charlotte region`);

const orgs = [];
for (const r of toProfile) {
  const ein = r.EIN.replace(/\D/g, '');
  const pp = await cachedFetch(`https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`, `propublica/${ein}.json`).catch(() => null);
  const filings = (pp?.filings_with_data ?? [])
    .filter((f) => f.totrevenue != null)
    .sort((a, b) => b.tax_prd - a.tax_prd)
    .slice(0, 5)
    .map((f) => ({
      taxYear: f.tax_prd_yr,
      periodEnd: String(f.tax_prd).replace(/^(\d{4})(\d{2})$/, '$1-$2'),
      form: f.formtype === 0 ? '990' : f.formtype === 1 ? '990-EZ' : f.formtype === 2 ? '990-PF' : String(f.formtype),
      revenue: f.totrevenue, expenses: f.totfuncexpns ?? null,
      contributions: f.totcntrbgfts ?? null, programRevenue: f.totprgmrevnue ?? null, investmentIncome: f.invstmntinc ?? null,
      assets: f.totassetsend ?? null, liabilities: f.totliabend ?? null, netAssets: f.totnetassetend ?? null,
      officerCompensation: f.compnsatncurrofcr ?? null,
      pdf: f.pdf_url || null,
    }));
  const [cur, prev] = filings;
  orgs.push({
    ein,
    name: titleCase(pp?.organization?.name || r.NAME),
    city: titleCase(r.CITY),
    zip: (r.ZIP || '').slice(0, 5) || null,
    county: r.geo?.county ?? null,
    rankStatewide: rankState.get(r.EIN) ?? null,
    rankRegion: rankRegion.get(r.EIN) ?? null,
    sector: NTEE[(r.NTEE_CD || 'Z')[0]] ?? 'Unclassified',
    nteeCode: r.NTEE_CD || null,
    taxStatus: SUBSECTION[r.SUBSECTION] ?? `501(c)(${Number(r.SUBSECTION)})`,
    rulingYear: r.RULING ? r.RULING.slice(0, 4) : null,
    irsBmf: { revenue: num(r.REVENUE_AMT), income: num(r.INCOME_AMT), assets: num(r.ASSET_AMT), taxPeriod: r.TAX_PERIOD },
    filings,
    derived: cur ? {
      surplus: cur.expenses != null ? cur.revenue - cur.expenses : null,
      surplusMargin: cur.expenses != null ? ratio(cur.revenue - cur.expenses, cur.revenue) : null,
      revenueGrowth: prev ? ratio(cur.revenue - prev.revenue, Math.abs(prev.revenue) || null) : null,
      liabilitiesToAssets: ratio(cur.liabilities, cur.assets),
      contributionShare: ratio(cur.contributions, cur.revenue),
    } : null,
    sources: {
      propublica: `https://projects.propublica.org/nonprofits/organizations/${ein}`,
      irsBmf: 'https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf',
    },
  });
}

await writeData('nonprofits.json', { source: 'IRS EO BMF + ProPublica Nonprofit Explorer (Form 990)', organizations: orgs });
console.log(`Wrote ${orgs.length} nonprofits (${orgs.filter((o) => o.filings.length).length} with 990 history) to site/data/nonprofits.json`);
