// Daily news updater for the Charlotte Business Tracker.
//   node update.mjs            collect new public-record facts, have Claude write stories, update site/data/news.json
//   node update.mjs --dry-run  collect facts and print them (no Claude call, no file changes)
//   node update.mjs --test     offline self-test of the validation and rendering
//
// Claude runs through the Claude Code CLI ("claude -p"). In GitHub Actions it authenticates with the
// CLAUDE_CODE_OAUTH_TOKEN secret, a Claude subscription token, so runs count against the subscription's
// usage limits instead of API billing. This script never reads an API key.
//
// Accuracy design: Claude never types a figure. Each fact carries pre-formatted tokens ({{F3.revenue}});
// the script substitutes them after validation and rejects any story with a stray digit, a direction verb
// ("rose", "fell"), markup, or a fact it wasn't given. Rejected stories are dropped, never "fixed".
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cachedFetch, titleCase } from './pipeline/lib.mjs';
import { ITEM_LABELS, DISTRESS_ITEMS, buildLatestQuarter, buildFinancials } from './pipeline/sec.mjs';

try { process.loadEnvFile(new URL('./.env', import.meta.url)); } catch {}

const NEWS_FILE = new URL('./site/data/news.json', import.meta.url);
const COMPANIES_FILE = new URL('./site/data/public-companies.json', import.meta.url);
const MODEL = 'claude-opus-5-5';
const WINDOW_DAYS = 4; // look-back for filings and awards; covers a weekend
const MAX_FACTS = 20; // per run: keeps the prompt, and subscription usage, small
const MAX_ITEMS = 400; // stories kept in news.json
const MIN_AWARD = 5e6; // federal awards below this aren't news
const SEC_HEADERS = process.env.SEC_USER_AGENT ? { 'User-Agent': process.env.SEC_USER_AGENT } : {};
const CATEGORIES = ['Earnings', 'Deals', 'Leadership', 'Distress', 'Markets', 'Contracts', 'Economy', 'Filings'];
const BLS_SERIES = [
  { id: 'LAUMT371674000000003', area: 'the Charlotte-Concord-Gastonia metro area' },
  { id: 'LASST370000000000003', area: 'North Carolina' },
];

// ---------- formatting (journalism style; every number in a story comes through here) ----------
const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const trim0 = (s) => s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
export function money(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return `$${trim0((a / 1e9).toFixed(2))} billion`;
  if (a >= 1e6) return `$${trim0((a / 1e6).toFixed(1))} million`;
  return `$${Math.round(a).toLocaleString('en-US')}`;
}
export const apDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const pct1 = (x) => `${trim0((Math.abs(x) * 100).toFixed(1))}%`;
export function changePhrase(cur, prior, fmt = money) {
  if (cur == null || prior == null || prior === 0) return null;
  const g = (cur - prior) / Math.abs(prior);
  if (Math.abs(g) < 0.0005) return `unchanged from ${fmt(prior)} a year earlier`;
  return `${g > 0 ? 'up' : 'down'} ${pct1(g)} from ${fmt(prior)} a year earlier`;
}
const netResult = (n) => (n == null ? null : n >= 0 ? `net income of ${money(n)}` : `a net loss of ${money(n)}`);
const eps = (n) => (n == null ? null : `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`);

// ---------- fact collection ----------
const pad = (cik) => String(cik).padStart(10, '0');
const NEWSWORTHY_ITEMS = new Set(['1.01', '1.02', '1.03', '2.01', '2.02', '2.03', '2.05', '2.06', '3.01', '3.03', '4.01', '4.02', '5.01', '5.02']);
const OTHER_FORMS = { 'S-1': 'registration statement for a new securities offering', '15-12G': 'notice ending its SEC registration', '25-NSE': 'notice removing its securities from an exchange' };

function priority(f) {
  if (f.kind === 'filing') {
    if (f.codes.some((c) => DISTRESS_ITEMS.has(c) || c === '1.03')) return 100;
    if (f.codes.some((c) => ['1.01', '2.01', '5.01'].includes(c))) return 80;
    if (f.tokens.revenue || f.tokens.netResult) return 70;
    if (OTHER_FORMS[f.form]) return 60;
    if (f.codes.includes('5.02')) return 50;
    return 20;
  }
  if (f.kind === 'economy') return 65;
  return 40 + Math.min(20, f.raw.amount / 1e8);
}

async function secFacts(companies, since) {
  const facts = [];
  for (const c of companies) {
    const sub = await cachedFetch(`https://data.sec.gov/submissions/CIK${pad(c.cik)}.json`, `news/sub-${c.cik}.json`, { days: 0.25, gapMs: 130, headers: SEC_HEADERS }).catch(() => null);
    const r = sub?.filings?.recent;
    if (!r) continue;
    let factsJson; // fetched lazily, only when a 10-Q/10-K needs figures
    for (let i = 0; i < r.form.length && r.filingDate[i] >= since; i++) {
      const form = r.form[i], accn = r.accessionNumber[i];
      const codes = (r.items[i] || '').split(',').map((s) => s.trim()).filter((x) => NEWSWORTHY_ITEMS.has(x));
      const isReport = form === '10-Q' || form === '10-K';
      if (!(form.startsWith('8-K') && codes.length) && !isReport && !OTHER_FORMS[form]) continue;
      const fact = {
        id: `sec:${accn}`, kind: 'filing', date: r.filingDate[i], form, codes,
        company: { cik: c.cik, name: c.name, ticker: c.tickers?.[0] ?? null, city: c.city, county: c.county, industry: c.industry },
        items: codes.map((x) => ITEM_LABELS[x]),
        formMeaning: OTHER_FORMS[form] ?? null,
        url: `https://www.sec.gov/Archives/edgar/data/${c.cik}/${accn.replace(/-/g, '')}/${r.primaryDocument[i]}`,
        tokens: { date: apDate(r.filingDate[i]) },
        raw: {},
      };
      if (isReport) {
        factsJson ??= await cachedFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad(c.cik)}.json`, `news/facts-${c.cik}.json`, { days: 0.25, gapMs: 130, headers: SEC_HEADERS }).catch(() => null);
        const q = form === '10-Q' ? buildLatestQuarter(factsJson) : null;
        const y = form === '10-K' ? buildFinancials(factsJson).years : null;
        if (q && q.accn === accn) {
          Object.assign(fact.tokens, {
            period: q.label, periodEnd: apDate(q.end),
            revenue: q.revenue != null ? money(q.revenue) : undefined,
            revenueChange: changePhrase(q.revenue, q.prior?.revenue) ?? undefined,
            netResult: netResult(q.netIncome) ?? undefined,
            netResultPrior: q.prior?.netIncome != null ? `${netResult(q.prior.netIncome)} a year earlier` : undefined,
            eps: eps(q.epsDiluted) ?? undefined, epsPrior: eps(q.prior?.epsDiluted) ?? undefined,
          });
          fact.raw = { revenue: q.revenue, revenueGrowth: q.revenueGrowth, netIncome: q.netIncome };
          if (q.revenueCalc) fact.revenueNote = 'Bank revenue here is calculated as net interest income plus noninterest income. Say so if you cite it.';
        } else if (y?.[0] && Math.abs(Date.parse(y[0].end) - Date.parse(r.reportDate[i])) < 15 * 864e5) {
          Object.assign(fact.tokens, {
            period: `fiscal ${y[0].end.slice(0, 4)}`, periodEnd: apDate(y[0].end),
            revenue: y[0].revenue != null ? money(y[0].revenue) : undefined,
            revenueChange: changePhrase(y[0].revenue, y[1]?.revenue) ?? undefined,
            netResult: netResult(y[0].netIncome) ?? undefined,
            netResultPrior: y[1]?.netIncome != null ? `${netResult(y[1].netIncome)} a year earlier` : undefined,
          });
          fact.raw = { revenue: y[0].revenue, netIncome: y[0].netIncome };
          if (y[0].revenueCalc) fact.revenueNote = 'Bank revenue here is calculated as net interest income plus noninterest income. Say so if you cite it.';
        } else {
          fact.note = 'The SEC structured-data feed has not published this report’s figures yet. Do not describe results.';
        }
        for (const k of Object.keys(fact.tokens)) if (fact.tokens[k] === undefined) delete fact.tokens[k];
      }
      facts.push(fact);
    }
  }
  return facts;
}

async function awardFacts(since, today) {
  const body = {
    filters: { time_period: [{ start_date: since, end_date: today }], recipient_locations: [{ country: 'USA', state: 'NC' }], award_type_codes: ['A', 'B', 'C', 'D'] },
    fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Start Date', 'Description', 'generated_internal_id'],
    sort: 'Award Amount', order: 'desc', limit: 25, page: 1,
  };
  const res = await cachedFetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', `news/awards-${today}.json`, { method: 'POST', body, days: 0.25, gapMs: 1000 }).catch(() => null);
  return (res?.results ?? [])
    .filter((a) => a['Start Date'] >= since && a['Award Amount'] >= MIN_AWARD)
    .slice(0, 8)
    .map((a) => ({
      id: `award:${a['Award ID']}`, kind: 'contract', date: a['Start Date'],
      recipient: titleCase(a['Recipient Name']), agency: a['Awarding Agency'],
      description: (a.Description || '').slice(0, 220),
      url: `https://www.usaspending.gov/award/${a.generated_internal_id}`,
      tokens: { amount: money(a['Award Amount']), date: apDate(a['Start Date']) },
      raw: { amount: a['Award Amount'] },
    }));
}

async function blsFacts() {
  const facts = [];
  for (const s of BLS_SERIES) {
    const res = await cachedFetch(`https://api.bls.gov/publicAPI/v1/timeseries/data/${s.id}`, `news/bls-${s.id}.json`, { days: 0.25, gapMs: 1000 }).catch(() => null);
    const data = (res?.Results?.series?.[0]?.data ?? []).filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period));
    const [cur, prev] = data;
    if (!cur || !prev) continue;
    const yearAgo = data.find((d) => d.period === cur.period && Number(d.year) === Number(cur.year) - 1);
    const month = Number(cur.period.slice(1)), prevMonth = Number(prev.period.slice(1));
    const diff = Math.round((Number(cur.value) - Number(prev.value)) * 10) / 10;
    facts.push({
      id: `bls:${s.id}:${cur.year}-${cur.period}`, kind: 'economy', date: `${cur.year}-${String(month).padStart(2, '0')}-01`,
      area: s.area, measure: 'unemployment rate (not seasonally adjusted, Bureau of Labor Statistics)',
      url: `https://data.bls.gov/timeseries/${s.id}`,
      tokens: {
        month: `${FULL_MONTHS[month - 1]} ${cur.year}`,
        rate: `${cur.value}%`,
        rateChange: diff === 0 ? `unchanged from ${FULL_MONTHS[prevMonth - 1]}` : `${diff > 0 ? 'up' : 'down'} ${Math.abs(diff)} percentage point${Math.abs(diff) === 1 ? '' : 's'} from ${FULL_MONTHS[prevMonth - 1]}`,
        ...(yearAgo ? { rateYearAgo: `${yearAgo.value}% a year earlier` } : {}),
      },
      raw: { rate: Number(cur.value) },
    });
  }
  return facts;
}

// ---------- Claude ----------
const SYSTEM_PROMPT = `You are a reporter for the Charlotte Business Tracker, a public-records financial news site covering North Carolina, with a focus on Charlotte, Mecklenburg County and Union County. Write short, original news stories from the facts you are given. You are not rewriting anyone else's article; the facts come from SEC filings, federal contract records and Bureau of Labor Statistics data.

Accuracy rules (a story that breaks any of them is discarded):
1. Use only the facts provided. No outside knowledge about any company, person, market or event. Do not explain why something happened, guess at motives, or predict outcomes. Do not invent quotes.
2. Every number, amount, percentage, period label and date must be written as a token from that fact's "tokens" object, in the form {{F3.revenue}}. Never type a digit yourself, except a four-digit year or an SEC form name such as 8-K, 10-Q or 10-K.
3. Never write rose, fell, grew, increased, decreased, declined, jumped, surged, plunged, dropped, climbed, soared, slumped or tumbled. Change tokens such as {{F3.revenueChange}} already state the direction.
4. When a fact has a "note" or "revenueNote", follow it.
5. A filing's "items" are the official SEC 8-K item descriptions. Report that the company filed them; describe nothing beyond what the item description says.

Style: objective, plain financial-news prose for business owners and investors. Lead with the most important fact. Write company names as given. Headline in sentence case, at most 100 characters. Dek: one sentence. One to three short paragraphs. "whyItMatters": one or two sentences on why this kind of record is significant, grounded in what the record type means, with no investment advice. Plain text only: no markdown, no HTML, no bullet points, no emoji, no em dashes.

Combine facts about the same company or event into one story. Skip facts with little news value by leaving them out. Write at most 8 stories. Pick each story's category from: ${CATEGORIES.join(', ')}.`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['stories'],
  properties: {
    stories: {
      type: 'array', maxItems: 8,
      items: {
        type: 'object', additionalProperties: false,
        required: ['factIds', 'category', 'headline', 'dek', 'paragraphs', 'whyItMatters'],
        properties: {
          factIds: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string' } },
          category: { type: 'string', enum: CATEGORIES },
          headline: { type: 'string', maxLength: 120 },
          dek: { type: 'string', maxLength: 260 },
          paragraphs: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', maxLength: 800 } },
          whyItMatters: { type: 'string', maxLength: 360 },
        },
      },
    },
  },
};

function askClaude(input) {
  const bin = process.env.CLAUDE_BIN || 'claude';
  const args = [
    '-p', '--output-format', 'json', '--json-schema', JSON.stringify(SCHEMA),
    '--model', MODEL, '--effort', 'medium', '--max-turns', '3', '--max-budget-usd', '1',
    '--tools', '', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence',
    '--permission-prompts', 'none', '--settings', JSON.stringify({ disableAllHooks: true }),
    '--system-prompt', SYSTEM_PROMPT,
  ];
  const [cmd, argv] = bin.endsWith('.js') ? [process.execPath, [bin, ...args]] : [bin, args];
  return new Promise(async (resolve, reject) => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'cbt-news-')); // empty dir: no project files or config to load
    const child = spawn(cmd, argv, { cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('claude timed out after 8 minutes')); }, 8 * 60e3);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      let parsed;
      try { parsed = JSON.parse(out); } catch { return reject(new Error(`claude exited ${code}; unparseable output: ${(out || err).slice(0, 400)}`)); }
      if (parsed.is_error || !parsed.structured_output) return reject(new Error(`claude returned no structured output: ${String(parsed.result ?? err).slice(0, 400)}`));
      resolve(parsed);
    });
    child.stdin.end(input);
  });
}

// ---------- validation & rendering ----------
const BANNED_VERBS = /\b(rose|rise[sn]?|fell|fall(s|en)?|grew|grow(s|n)?|increas(e|ed|es)|decreas(e|ed|es)|declin(e|ed|es)|jump(s|ed)?|surg(e|ed|es)|plung(e|ed|es)|dropp(ed)?|drops?|climb(s|ed)?|soar(s|ed)?|slump(s|ed)?|tumbl(e|ed|es))\b/i;
const ALLOWED_DIGITS = /\b(19|20)\d{2}\b|\b(10-K|10-Q|8-K|20-F|S-1|15-12G|25-NSE|DEF 14A)\b/g;
const TOKEN = /\{\{F(\d+)\.(\w+)\}\}/g;
const slug = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

// Returns { story } or { error }. `facts` is the F-numbered list sent to Claude.
export function renderStory(raw, facts, date) {
  const byId = Object.fromEntries(facts.map((f, i) => [`F${i + 1}`, f]));
  if (!CATEGORIES.includes(raw.category)) return { error: `bad category ${raw.category}` };
  if (!raw.factIds?.length || raw.factIds.some((id) => !byId[id])) return { error: `unknown fact id in ${raw.factIds}` };
  const texts = [raw.headline, raw.dek, ...raw.paragraphs, raw.whyItMatters];
  if (texts.some((t) => typeof t !== 'string' || !t.trim())) return { error: 'empty field' };
  if (raw.headline.length > 120 || raw.dek.length > 260 || raw.whyItMatters.length > 360 || raw.paragraphs.length > 3 || raw.paragraphs.some((p) => p.length > 800)) return { error: 'too long' };
  // Names (which may contain digits) are allowed verbatim; everything else numeric must be a token.
  const names = facts.flatMap((f) => [f.company?.name, f.recipient, f.agency].filter(Boolean)).sort((a, b) => b.length - a.length);
  for (const t of texts) {
    if (/[<>`*#|]|\[|\]\(/.test(t)) return { error: 'markup in text' };
    if (BANNED_VERBS.test(t)) return { error: `direction verb in: ${t.match(BANNED_VERBS)[0]}` };
    let bare = t.replace(TOKEN, '');
    for (const n of names) bare = bare.split(n).join('');
    if (/\d/.test(bare.replace(ALLOWED_DIGITS, ''))) return { error: `typed number in: ${t.slice(0, 80)}` };
  }
  let missing = null;
  const fill = (t) => t.replace(TOKEN, (m, n, key) => {
    const v = byId[`F${n}`]?.tokens?.[key];
    if (v == null) missing = m;
    return v ?? m;
  }).replace(/\s*—\s*/g, ', ').replace(/\s+/g, ' ').trim();
  const story = {
    headline: fill(raw.headline), dek: fill(raw.dek), paragraphs: raw.paragraphs.map(fill), whyItMatters: fill(raw.whyItMatters),
  };
  if (missing) return { error: `token not available: ${missing}` };
  const cited = raw.factIds.map((id) => byId[id]);
  const label = (f) => f.kind === 'filing' ? `SEC Form ${f.form}, ${f.company.name}, filed ${f.tokens.date}`
    : f.kind === 'contract' ? `USAspending.gov award to ${f.recipient}`
    : `Bureau of Labor Statistics, ${f.area}`;
  return {
    story: {
      id: `${date}-${slug(story.headline)}`,
      date, category: raw.category, ...story,
      entities: [...new Map(cited.filter((f) => f.company).map((f) => [f.company.cik, { cik: f.company.cik, name: f.company.name }])).values()],
      sources: cited.map((f) => ({ label: label(f), url: f.url })),
      factIds: cited.map((f) => f.id),
      model: MODEL,
    },
  };
}

// ---------- main ----------
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const since = new Date(now.getTime() - WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
  const news = await fs.readFile(NEWS_FILE, 'utf8').then(JSON.parse).catch(() => ({ items: [], coveredFactIds: [] }));
  const covered = new Set(news.coveredFactIds ?? []);
  const { companies } = JSON.parse(await fs.readFile(COMPANIES_FILE, 'utf8'));

  const all = [...await secFacts(companies, since), ...await awardFacts(since, today), ...await blsFacts()];
  const fresh = all.filter((f) => !covered.has(f.id)).sort((a, b) => priority(b) - priority(a)).slice(0, MAX_FACTS);
  console.log(`Facts: ${all.length} in the last ${WINDOW_DAYS} days, ${fresh.length} new (cap ${MAX_FACTS}).`);
  if (!fresh.length) { console.log('Nothing new. No Claude call, no file change.'); return; }

  // What Claude sees: short ids, readable fields and the tokens it must use. No URLs (it can't cite what it can't see).
  const payload = {
    today: apDate(today),
    facts: fresh.map((f, i) => ({ id: `F${i + 1}`, ...Object.fromEntries(Object.entries(f).filter(([k]) => !['id', 'url', 'raw', 'codes'].includes(k))) })),
  };
  if (dryRun) { console.log(JSON.stringify(payload, null, 2)); return; }

  const res = await askClaude(JSON.stringify(payload));
  console.log(`Claude: ${res.structured_output.stories.length} stories, ${res.num_turns ?? '?'} turns, est. $${(res.total_cost_usd ?? 0).toFixed(3)} (subscription runs are not billed per token).`);

  const accepted = [], usedFacts = new Set(), rejectedFacts = new Set();
  const ids = new Set(news.items.map((s) => s.id));
  for (const raw of res.structured_output.stories) {
    const { story, error } = renderStory(raw, fresh, today);
    if (error) { console.log(`  rejected "${raw.headline}": ${error}`); raw.factIds?.forEach((id) => rejectedFacts.add(id)); continue; }
    while (ids.has(story.id)) story.id += '-2';
    ids.add(story.id);
    story.publishedAt = now.toISOString();
    accepted.push(story);
    story.factIds.forEach((id) => usedFacts.add(id));
    console.log(`  + [${story.category}] ${story.headline}`);
  }
  // Facts Claude used, or chose to skip, are done. Facts only in rejected stories get another try next run.
  const done = fresh.filter((f, i) => usedFacts.has(f.id) || !rejectedFacts.has(`F${i + 1}`)).map((f) => f.id);
  const out = {
    generatedAt: now.toISOString(),
    coveredFactIds: [...done, ...covered].slice(0, 3000),
    items: [...accepted, ...news.items].slice(0, MAX_ITEMS),
  };
  await fs.writeFile(NEWS_FILE, JSON.stringify(out, null, 1) + '\n');
  console.log(`news.json: ${accepted.length} new stories, ${out.items.length} total.`);
}

function selfTest() {
  assert.equal(money(29.96e9), '$29.96 billion');
  assert.equal(money(1e9), '$1 billion');
  assert.equal(money(-13.4e6), '$13.4 million');
  assert.equal(apDate('2026-09-30'), 'Sept. 30, 2026');
  assert.equal(changePhrase(50, 40), 'up 25% from $40 a year earlier');
  assert.equal(changePhrase(30, 40), 'down 25% from $40 a year earlier');
  const facts = [
    { id: 'sec:1', kind: 'filing', form: '10-Q', company: { cik: 1, name: '3D Widgets Inc' }, url: 'u1', tokens: { date: 'Nov. 18, 2026', revenue: '$1.2 billion', revenueChange: 'up 5% from $1.14 billion a year earlier', period: 'Q3 FY2026' } },
    { id: 'award:9', kind: 'contract', recipient: 'Acme LLC', agency: 'Department of Defense', url: 'u2', tokens: { amount: '$99.6 million' } },
  ];
  const ok = renderStory({ factIds: ['F1'], category: 'Earnings', headline: '3D Widgets Inc reports {{F1.period}} revenue of {{F1.revenue}}', dek: 'Revenue was {{F1.revenueChange}}.', paragraphs: ['3D Widgets Inc filed its 10-Q on {{F1.tokens}}.'], whyItMatters: 'A 10-Q is a quarterly report.' }, facts, '2026-11-19');
  assert.match(ok.error, /token not available/, 'missing token rejects the story');
  const good = renderStory({ factIds: ['F1'], category: 'Earnings', headline: '3D Widgets Inc reports {{F1.period}} revenue of {{F1.revenue}}', dek: 'Revenue was {{F1.revenueChange}} in its 2026 third quarter.', paragraphs: ['3D Widgets Inc filed its 10-Q on {{F1.date}}.'], whyItMatters: 'A 10-Q is the quarterly report public companies must file.' }, facts, '2026-11-19');
  assert.equal(good.error, undefined);
  assert.equal(good.story.headline, '3D Widgets Inc reports Q3 FY2026 revenue of $1.2 billion');
  assert.deepEqual(good.story.entities, [{ cik: 1, name: '3D Widgets Inc' }]);
  assert.equal(good.story.sources[0].url, 'u1');
  const base = { factIds: ['F2'], category: 'Contracts', headline: 'Acme LLC wins {{F2.amount}} award', dek: 'x.', paragraphs: ['y.'], whyItMatters: 'z.' };
  assert.match(renderStory({ ...base, dek: 'The award is worth $99.6 million.' }, facts, 'd').error, /typed number/);
  assert.match(renderStory({ ...base, dek: 'Spending rose this year.' }, facts, 'd').error, /direction verb/);
  assert.match(renderStory({ ...base, dek: '**Big** news' }, facts, 'd').error, /markup/);
  assert.match(renderStory({ ...base, factIds: ['F7'] }, facts, 'd').error, /unknown fact/);
  assert.match(renderStory({ ...base, category: 'Gossip' }, facts, 'd').error, /bad category/);
  assert.equal(renderStory(base, facts, 'd').story.headline, 'Acme LLC wins $99.6 million award');
  console.log('update.mjs self-test passed');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--test')) selfTest();
  else await main().catch((e) => { console.error(`Update failed: ${e.message}`); process.exit(1); });
}
