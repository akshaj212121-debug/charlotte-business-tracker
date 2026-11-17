// Builds the Charlotte Business Tracker base described in airtable-schema.md.
//   node build-base.mjs        -> adds the 5 tables to the base, prints what still needs the UI
//   node build-base.mjs check  -> tests the Publish Ready formula with a throwaway record
// Needs charlotte-tracker/.env with AIRTABLE_TOKEN and AIRTABLE_BASE_ID (git-ignored).
process.loadEnvFile(new URL('.env', import.meta.url));
const { AIRTABLE_TOKEN: TOKEN, AIRTABLE_BASE_ID: BASE } = process.env;
if (!TOKEN || !BASE) throw new Error('Set AIRTABLE_TOKEN and AIRTABLE_BASE_ID in charlotte-tracker/.env');

async function call(method, path, body) {
  const res = await fetch(`https://api.airtable.com/v0/${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const text = (name) => ({ name, type: 'singleLineText' });
const long = (name) => ({ name, type: 'multilineText' });
const url = (name) => ({ name, type: 'url' });
const date = (name) => ({ name, type: 'date', options: { dateFormat: { name: 'iso' } } });
const num = (name) => ({ name, type: 'number', options: { precision: 2 } });
const usd = (name) => ({ name, type: 'currency', options: { precision: 2, symbol: '$' } });
const choices = (list) => ({ choices: list.map((name) => ({ name })) });
const select = (name, list) => ({ name, type: 'singleSelect', options: choices(list) });
const multi = (name, list) => ({ name, type: 'multipleSelects', options: choices(list) });

const COUNTIES = ['Mecklenburg', 'Union'];
const REGISTRIES = ['NCSOS', 'Mecklenburg ROD', 'Union ROD', 'Mecklenburg Clerk (eCourts)', 'Union Clerk (eCourts)', 'PACER WDNC', 'SEC EDGAR', 'NC Commerce WARN'];
const VERIFICATION = ['Primary doc reviewed', 'Index entry only', 'Unverified – do not publish'];

const TABLES = [
  { name: 'Entities', fields: [
    text('Legal Name'), text('NCSOS SOSID'),
    select('Entity Type', ['LLC', 'Corporation', 'LP', 'Nonprofit', 'Other']),
    multi('County', COUNTIES), long('Principal Address'), text('Registered Agent'),
    select('NCSOS Status', ['Current-Active', 'Admin Dissolved', 'Dissolved', 'Withdrawn']),
    date('Formation Date'),
    select('Industry', ['Banking & Finance', 'Real Estate', 'Construction', 'Restaurants & Hospitality', 'Retail', 'Healthcare', 'Logistics', 'Technology', 'Professional Services', 'Manufacturing', 'Other']),
    text('Ticker'),
  ] },
  { name: 'Filings', fields: [
    text('Filing'), // primary; converted to a formula in the UI (API can't change field types)
    select('Filing Type', ['Formation', 'Admin Dissolution', 'Voluntary Dissolution', 'Reinstatement', 'UCC Financing Statement', 'Federal Tax Lien', 'Federal Tax Lien Release', 'NC Certificate of Tax Liability', 'Claim of Lien on Real Property', 'Lis Pendens', 'Foreclosure Special Proceeding', 'Civil Judgment', 'Bankruptcy Petition Ch 7', 'Bankruptcy Petition Ch 11 / Subchapter V', 'Ch 11 MOR', 'SEC 8-K', 'WARN Notice', 'Commercial Deed']),
    select('Signal Category', ['Formation', 'Distress', 'Recovery', 'Disclosure', 'Real Estate']),
    date('Filing Date'), date('Recorded / Docket Date'), select('County', COUNTIES),
    select('Source Registry', REGISTRIES),
    select('Source Type', ['Public Registry', 'Court Record', 'SEC Disclosure', 'Government Report']),
    text('Document / Case No.'), url('Source URL'), usd('Amount'),
    select('Amount Basis', ['Stated in document', 'Not stated', 'N/A']),
    select('Amount Kind', ['Lien / Judgment', 'Claim', 'Sale Price', 'Cash Flow']),
    select('Verification Status', VERIFICATION), text('Verified By'), date('Verified Date'),
    long('Raw Record'), long('Why It Matters'),
  ] },
  { name: 'News', fields: [
    text('Headline'), text('Outlet'), date('Publish Date'), url('URL'), long('Claim Summary'),
  ] },
  { name: 'Metrics', fields: [
    text('Metric Period'), // primary; converted to a formula in the UI
    select('Metric', ['New LLC formations – Mecklenburg', 'New LLC formations – Union']),
    date('Period Start'), date('Period End'), num('Value'), select('Unit', ['Count', 'USD', 'Percent']),
    select('Source Registry', [...REGISTRIES, 'BLS', 'US Census Bureau']),
    url('Source URL'), long('Method'), select('Verification Status', VERIFICATION),
  ] },
  { name: 'Issues', fields: [
    text('Issue Title'), date('Publish Date'),
    select('Status', ['Drafting', 'Fact-check', 'Published', 'Correction issued']),
    long('Editor Notes'),
  ] },
];

// One side of each link; Airtable creates the reverse field (named after this table).
const LINKS = [
  ['Filings', 'Entity', 'Entities'],
  ['Filings', 'Issue', 'Issues'],
  ['News', 'Entities', 'Entities'],
  ['News', 'Corroborating Filings', 'Filings'],
  ['News', 'Issue', 'Issues'],
  ['Metrics', 'Issue', 'Issues'],
];

const PUBLISH_READY = `IF(
  AND(
    {Verification Status} = "Primary doc reviewed",
    {Document / Case No.},
    {Source URL},
    {Raw Record},
    OR(NOT({Amount}), AND({Amount Basis} = "Stated in document", {Amount Kind})),
    OR({Amount Kind} != "Cash Flow", {Source Type} = "SEC Disclosure", {Filing Type} = "Ch 11 MOR")
  ),
  "YES",
  "NO"
)`;

async function build() {
  const tableId = {};
  for (const table of TABLES) tableId[table.name] = (await call('POST', `meta/bases/${BASE}/tables`, table)).id;
  console.log(`Tables created: ${Object.keys(tableId).join(', ')}`);
  const fieldPath = (table) => `meta/bases/${BASE}/tables/${tableId[table]}/fields`;

  const linkId = {};
  for (const [from, name, to] of LINKS) {
    const field = await call('POST', fieldPath(from), { name, type: 'multipleRecordLinks', options: { linkedTableId: tableId[to] } });
    linkId[`${from}.${name}`] = field.id;
  }
  console.log(`Links created: ${LINKS.length}`);

  const manual = [
    'Rename the base to "Charlotte Business Tracker" and delete the default "Table 1"',
    'Filings > Filing: convert to the formula in airtable-schema.md',
    'Metrics > Metric Period: convert to the formula in airtable-schema.md',
    'Entities > Distress Signal Count: Count of Filings, condition Signal Category = Distress',
    'Views: all 6 in the Views section of airtable-schema.md',
  ];
  const optional = [
    ['Filings', { name: 'Publish Ready', type: 'formula', options: { formula: PUBLISH_READY } }],
    ['News', { name: 'Corroborated', type: 'count', options: { recordLinkFieldId: linkId['News.Corroborating Filings'] } }],
  ];
  for (const [table, field] of optional) {
    try {
      await call('POST', fieldPath(table), field);
      console.log(`Created ${table} > ${field.name}`);
    } catch (err) {
      manual.push(`${table} > ${field.name}: API refused (${err.message.slice(0, 120)})`);
    }
  }

  const schema = await call('GET', `meta/bases/${BASE}/tables`);
  for (const t of schema.tables) console.log(`${t.name}: ${t.fields.map((f) => f.name).join(', ')}`);
  console.log('\nStill needs the Airtable UI:\n- ' + manual.join('\n- '));
}

// Throwaway record: Publish Ready must flip NO -> YES -> NO, then the record is deleted.
async function check() {
  const path = `${BASE}/Filings`;
  const readyAfter = async (id, fields) => {
    await call('PATCH', `${path}/${id}`, { fields });
    return (await call('GET', `${path}/${id}`)).fields['Publish Ready'];
  };
  const rec = await call('POST', path, { fields: { 'Raw Record': 'TEST RECORD – safe to delete', 'Verification Status': 'Unverified – do not publish' } });
  try {
    const results = [
      ['unverified', await readyAfter(rec.id, {}), 'NO'],
      ['reviewed + doc no. + URL', await readyAfter(rec.id, { 'Verification Status': 'Primary doc reviewed', 'Document / Case No.': 'TEST', 'Source URL': 'https://example.com' }), 'YES'],
      ['cash flow from public registry', await readyAfter(rec.id, { Amount: 1, 'Amount Basis': 'Stated in document', 'Amount Kind': 'Cash Flow', 'Source Type': 'Public Registry' }), 'NO'],
      ['cash flow from SEC disclosure', await readyAfter(rec.id, { 'Source Type': 'SEC Disclosure' }), 'YES'],
    ];
    for (const [label, got, want] of results) console.log(`${got === want ? 'PASS' : 'FAIL'}  ${label}: ${got} (want ${want})`);
  } finally {
    await call('DELETE', `${path}/${rec.id}`);
    console.log('Test record deleted.');
  }
}

if (process.argv[2] === 'check') await check();
else await build();
