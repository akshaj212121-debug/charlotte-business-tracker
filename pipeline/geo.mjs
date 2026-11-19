// ZIP -> NC county lookup, from the Census Bureau's 2020 ZCTA-to-county relationship file.
// A ZIP that spans counties is assigned to the county holding the most of its land area.
// ZCTAs approximate USPS ZIP codes; methodology page says so.
import assert from 'node:assert/strict';
import { cachedFetch } from './lib.mjs';

// Charlotte-Concord-Gastonia MSA, NC counties (OMB Bulletin 23-01). Core = the tracker's home counties.
export const REGION = {
  '119': 'Mecklenburg', '179': 'Union',
  '025': 'Cabarrus', '071': 'Gaston', '097': 'Iredell', '109': 'Lincoln', '159': 'Rowan', '007': 'Anson',
};
export const CORE = new Set(['Mecklenburg', 'Union']);
export const REGION_NAMES = new Set(Object.values(REGION));

export function buildZipCounty(text) {
  const best = {};
  for (const line of text.split('\n').slice(1)) {
    const f = line.split('|');
    const zip = f[1], county = f[9], name = f[10], land = Number(f[16]);
    if (!zip || !county?.startsWith('37')) continue; // NC only
    if (!best[zip] || land > best[zip].land) best[zip] = { land, name: name.replace(/ County$/, '') };
  }
  return Object.fromEntries(Object.entries(best).map(([z, v]) => [z, v.name]));
}

let lookup;
export async function zipToCounty() {
  if (!lookup) {
    const text = await cachedFetch('https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt', 'geo/zcta_county.txt', { json: false, days: 365 });
    lookup = buildZipCounty(text);
  }
  return (zip) => lookup[String(zip ?? '').slice(0, 5)] ?? null;
}

// City -> county by majority vote over every NC exempt organization in the IRS master file whose
// ZIP resolves. Fallback for unique/PO-box ZIPs (e.g. 28255, Bank of America) that have no ZCTA.
export function buildCityCounty(rows, zipFn) {
  const votes = {};
  for (const r of rows) {
    const county = zipFn(r.ZIP);
    const city = (r.CITY || '').toUpperCase().trim();
    if (!county || !city) continue;
    (votes[city] ??= {})[county] = (votes[city][county] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(votes).map(([city, v]) => [city, Object.entries(v).sort((a, b) => b[1] - a[1])[0][0]]));
}

let resolver;
// Returns (zip, city) => { county, from: 'zip' | 'city' } | null
export async function countyResolver() {
  if (!resolver) {
    const { parseCsv } = await import('./lib.mjs');
    const zipFn = await zipToCounty();
    const bmf = parseCsv(await cachedFetch('https://www.irs.gov/pub/irs-soi/eo_nc.csv', 'irs/eo_nc.csv', { json: false }));
    const cities = buildCityCounty(bmf, zipFn);
    resolver = (zip, city) => {
      const byZip = zipFn(zip);
      if (byZip) return { county: byZip, from: 'zip' };
      const byCity = cities[(city || '').toUpperCase().trim()];
      return byCity ? { county: byCity, from: 'city' } : null;
    };
  }
  return resolver;
}

if (process.argv[1]?.endsWith('geo.mjs')) {
  const sample = 'h\n' + [
    '|28202|ZCTA5 28202|1|0|G6350|B5|S|1|37119|Mecklenburg County|1|0|G4020|H1|A|500|0',
    '|28104|ZCTA5 28104|1|0|G6350|B5|S|1|37119|Mecklenburg County|1|0|G4020|H1|A|100|0',
    '|28104|ZCTA5 28104|1|0|G6350|B5|S|1|37179|Union County|1|0|G4020|H1|A|900|0',
    '|29715|ZCTA5 29715|1|0|G6350|B5|S|1|45091|York County|1|0|G4020|H1|A|900|0',
  ].join('\n');
  const m = buildZipCounty(sample);
  assert.equal(m['28202'], 'Mecklenburg');
  assert.equal(m['28104'], 'Union', 'largest land share wins');
  assert.equal(m['29715'], undefined, 'non-NC ignored');
  const real = await zipToCounty();
  assert.equal(real('28202-4000'), 'Mecklenburg');
  assert.equal(real('28173'), 'Union'); // Waxhaw
  const cityMap = buildCityCounty([{ ZIP: '28202', CITY: 'Charlotte' }, { ZIP: '28203', CITY: 'charlotte' }, { ZIP: '28104', CITY: 'Charlotte' }], (z) => m[z] ?? (z === '28203' ? 'Mecklenburg' : null));
  assert.equal(cityMap.CHARLOTTE, 'Mecklenburg', 'majority wins');
  const resolve = await countyResolver();
  assert.deepEqual(resolve('28255', 'CHARLOTTE'), { county: 'Mecklenburg', from: 'city' });
  assert.deepEqual(resolve('28104', 'Weddington'), { county: 'Union', from: 'zip' });
  console.log('geo.mjs self-test passed');
}
