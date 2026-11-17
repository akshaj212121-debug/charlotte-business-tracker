// Shared helpers for the non-SEC pipeline stages: cached + throttled fetch, CSV parsing, output.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

export const UA = 'CharlotteBusinessTracker/1.0 (public-records research)';
const CACHE = new URL('./.cache/', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lastHit = {};

// Fetch with an on-disk cache (default 25 days so the monthly run refreshes) and a per-host gap.
export async function cachedFetch(url, key, { days = 25, gapMs = 500, method = 'GET', body, json = true } = {}) {
  const file = new URL(key, CACHE);
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs < days * 864e5) {
      const text = await fs.readFile(file, 'utf8');
      return json ? JSON.parse(text) : text;
    }
  } catch {}
  const host = new URL(url).host;
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = (lastHit[host] ?? 0) + gapMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastHit[host] = Date.now();
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': UA, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 404) return null;
    if (res.ok) {
      const text = await res.text();
      await fs.mkdir(new URL('.', file), { recursive: true });
      await fs.writeFile(file, text);
      return json ? JSON.parse(text) : text;
    }
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`fetch failed: ${url}`);
}

// RFC 4180-style CSV: quoted fields, doubled quotes, commas/newlines inside quotes.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

export async function writeData(name, payload) {
  const out = new URL(`../site/data/${name}`, import.meta.url);
  await fs.mkdir(new URL('.', out), { recursive: true });
  await fs.writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), ...payload }, null, 1));
}

export const titleCase = (s = '') => s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
  .replace(/(?<=\s)(Of|And|The|For|In|At|On)\b/g, (m) => m.toLowerCase())
  .replace(/\b(Llc|Lp|Llp|Pllc|Usa|Nc|Unc|Ii|Iii)\b/g, (m) => m.toUpperCase());

// SEC conformed names are often ALL CAPS with a state suffix ("BANK OF AMERICA CORP /DE/").
// Mixed-case names are kept as filed; all-caps ones are title-cased for display.
export const displayName = (s = '') => {
  const bare = s.replace(/\s*\/[A-Z]{2}\/?\s*$/, '').trim();
  return /[a-z]/.test(bare) ? bare : titleCase(bare);
};

if (process.argv[1]?.endsWith('lib.mjs')) {
  const rows = parseCsv('a,b,c\n1,"x, y",3\r\n4,"he said ""hi""",6\n');
  assert.deepEqual(rows[0], { a: '1', b: 'x, y', c: '3' });
  assert.equal(rows[1].b, 'he said "hi"');
  assert.equal(titleCase('NOVANT HEALTH INC'), 'Novant Health Inc');
  assert.equal(titleCase('THALLE - BAUER LLC'), 'Thalle - Bauer LLC');
  assert.equal(displayName('BANK OF AMERICA CORP /DE/'), 'Bank of America Corp');
  assert.equal(displayName('Duke Energy CORP'), 'Duke Energy CORP');
  console.log('lib.mjs self-test passed');
}
