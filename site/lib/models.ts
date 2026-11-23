// Pure math for the /models section. No I/O here, so the same code runs on the server (to shape data)
// and in the browser (to recompute models as the reader changes assumptions).
// Every input figure comes from SEC filings via site/data; every assumption is labeled as one.

export interface ModelYear {
  end: string;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  ocf: number | null;
  capex: number | null;
  fcf: number | null;
  eps: number | null;
  dps: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  cash: number | null;
  debt: number | null;
}

export interface PricePoint { value: number; date: string; source: string }

export interface ModelCompany {
  cik: number;
  name: string;
  ticker: string | null;
  industry: string;
  sic: string;
  city: string;
  financial: boolean; // SIC 6000-6799: banks, insurers, REITs. Cash-flow DCFs don't fit these well.
  years: ModelYear[]; // oldest -> newest
  filingsUrl: string;
  distressSignals: number; // count of distress-flagged 8-K items in the filing list
  closes: [string, number][] | null; // daily closes oldest -> newest, from data/prices.json when present
  lastClose: PricePoint | null;
}

// ---------- basic statistics ----------
export const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
export function stdev(xs: number[]) {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}
export function median(xs: number[]) {
  const s = xs.filter(isNum).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function linreg(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const slope = sxx ? sxy / sxx : NaN;
  const intercept = my - slope * mx;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : NaN;
  return { slope, intercept, r2, n };
}

export function correlation(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  const x = a.slice(-n), y = b.slice(-n);
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Year-over-year growth rates of a series (skips pairs with a missing or non-positive base). */
export function growthRates(values: (number | null)[]) {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const a = values[i - 1], b = values[i];
    if (isNum(a) && isNum(b) && a > 0) out.push(b / a - 1);
  }
  return out;
}

export function cagr(first: number | null, last: number | null, years: number) {
  if (!isNum(first) || !isNum(last) || first <= 0 || last <= 0 || years <= 0) return NaN;
  return (last / first) ** (1 / years) - 1;
}

// Deterministic PRNG so a Monte Carlo run gives the same picture for the same inputs.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normal(rand: () => number) {
  const u = Math.max(rand(), 1e-12), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------- company-level helpers ----------
export const latestYear = (c: ModelCompany) => c.years[c.years.length - 1];

/** Diluted shares implied by the filing: net income / diluted EPS. An estimate, labeled as one in the UI. */
export function impliedShares(c: ModelCompany) {
  const y = latestYear(c);
  if (!y || !isNum(y.netIncome) || !isNum(y.eps) || y.eps === 0) return null;
  const s = y.netIncome / y.eps;
  return s > 0 ? s : null;
}

export function netDebt(c: ModelCompany) {
  const y = latestYear(c);
  return (y?.debt ?? 0) - (y?.cash ?? 0);
}

/** Base free cash flow for a DCF, and how it was obtained. */
export function baseFcf(c: ModelCompany): { value: number | null; note: string } {
  const y = latestYear(c);
  if (!y) return { value: null, note: "No annual data." };
  if (isNum(y.fcf)) return { value: y.fcf, note: `Free cash flow, ${y.end.slice(0, 4)} (operating cash flow minus capital spending).` };
  if (isNum(y.ocf)) return { value: y.ocf, note: `Capital spending isn't tagged in this filing, so operating cash flow (${y.end.slice(0, 4)}) is used. That overstates free cash flow.` };
  return { value: null, note: "No cash-flow figures in the filing data." };
}

const ratio = (a: number | null, b: number | null) => (isNum(a) && isNum(b) && b !== 0 ? a / b : null);
const avg = (xs: (number | null)[]) => { const v = xs.filter(isNum); return v.length ? mean(v) : null; };

export interface Assumptions {
  growth: number; // revenue growth per year
  opMargin: number;
  netMargin: number;
  cashConversion: number; // operating cash flow / net income
  capexPct: number; // capex / revenue
  payout: number; // dividends / net income
  netBorrowing: number; // $ new debt per year (negative = repayment)
}

/** Simple, transparent defaults from the company's own history. These are starting points, not forecasts. */
export function defaultAssumptions(c: ModelCompany): Assumptions {
  const ys = c.years;
  const g = median(growthRates(ys.map((y) => y.revenue)));
  const opM = avg(ys.map((y) => ratio(y.operatingIncome, y.revenue)));
  const netM = avg(ys.map((y) => ratio(y.netIncome, y.revenue)));
  const conv = avg(ys.map((y) => (isNum(y.netIncome) && y.netIncome > 0 ? ratio(y.ocf, y.netIncome) : null)));
  const capex = avg(ys.map((y) => ratio(y.capex, y.revenue)));
  const shares = impliedShares(c);
  const last = latestYear(c);
  const payout = shares && isNum(last?.dps) && isNum(last?.netIncome) && last.netIncome > 0 ? (last.dps * shares) / last.netIncome : 0;
  return {
    growth: isNum(g) ? clamp(g, -0.05, 0.15) : 0.03,
    opMargin: opM != null ? clamp(opM, -0.5, 0.6) : netM != null ? clamp(netM, -0.5, 0.6) : 0.1,
    netMargin: netM != null ? clamp(netM, -0.5, 0.5) : 0.08,
    cashConversion: conv != null ? clamp(conv, 0, 3) : 1,
    capexPct: capex != null ? clamp(capex, 0, 0.5) : 0,
    payout: clamp(payout, 0, 1.5),
    netBorrowing: 0,
  };
}

// ---------- three-statement projection ----------
export interface StatementYear {
  label: string;
  projected: boolean;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  ocf: number | null;
  capex: number | null;
  fcf: number | null;
  dividends: number | null;
  netBorrowing: number | null;
  cash: number | null;
  otherAssets: number | null;
  assets: number | null;
  debt: number | null;
  otherLiabilities: number | null;
  liabilities: number | null;
  equity: number | null;
  check: number | null; // assets - liabilities - equity (0 = balanced)
}

export function threeStatement(c: ModelCompany, a: Assumptions, horizon = 5): StatementYear[] {
  const hist: StatementYear[] = c.years.map((y) => {
    const liabilities = y.liabilities ?? (isNum(y.assets) && isNum(y.equity) ? y.assets - y.equity : null);
    return {
      label: `FY${y.end.slice(0, 4)}`, projected: false,
      revenue: y.revenue, operatingIncome: y.operatingIncome, netIncome: y.netIncome,
      ocf: y.ocf, capex: y.capex, fcf: y.fcf ?? (isNum(y.ocf) && isNum(y.capex) ? y.ocf - y.capex : null),
      dividends: null, netBorrowing: null,
      cash: y.cash, otherAssets: isNum(y.assets) && isNum(y.cash) ? y.assets - y.cash : null, assets: y.assets,
      debt: y.debt, otherLiabilities: isNum(liabilities) ? liabilities - (y.debt ?? 0) : null, liabilities,
      equity: y.equity,
      check: isNum(y.assets) && isNum(liabilities) && isNum(y.equity) ? y.assets - liabilities - y.equity : null,
    };
  });
  const last = latestYear(c);
  if (!last || !isNum(last.revenue)) return hist;
  const year0 = Number(last.end.slice(0, 4));
  let rev = last.revenue;
  let cash = last.cash ?? 0;
  let debt = last.debt ?? 0;
  let equity = last.equity ?? 0;
  const liab0 = last.liabilities ?? (isNum(last.assets) ? last.assets - equity : 0);
  const otherLiab = liab0 - debt; // held flat: the model doesn't forecast payables, deposits, etc.
  let otherAssets = (last.assets ?? liab0 + equity) - cash;
  const out = [...hist];
  for (let i = 1; i <= horizon; i++) {
    rev = rev * (1 + a.growth);
    const op = rev * a.opMargin;
    const ni = rev * a.netMargin;
    const ocf = ni * a.cashConversion;
    const capex = rev * a.capexPct;
    const fcf = ocf - capex;
    const div = Math.max(0, ni) * a.payout;
    // Link the statements: cash moves by FCF - dividends + new borrowing; equity by net income - dividends.
    cash = cash + fcf - div + a.netBorrowing;
    debt = debt + a.netBorrowing;
    equity = equity + ni - div;
    // Non-cash assets absorb (net income - FCF): the non-cash earnings plus capex that the filing data can't split out.
    otherAssets = otherAssets + (ni - fcf);
    const assets = cash + otherAssets;
    const liabilities = debt + otherLiab;
    out.push({
      label: `FY${year0 + i}E`, projected: true,
      revenue: rev, operatingIncome: op, netIncome: ni, ocf, capex, fcf, dividends: div, netBorrowing: a.netBorrowing,
      cash, otherAssets, assets, debt, otherLiabilities: otherLiab, liabilities, equity,
      check: assets - liabilities - equity,
    });
  }
  return out;
}

// ---------- DCF ----------
export interface DcfInput { fcf0: number; growth: number; years: number; wacc: number; terminalGrowth: number; netDebt: number; shares: number | null }
export interface DcfResult {
  rows: { year: number; fcf: number; discount: number; pv: number }[];
  pvFcf: number; terminalValue: number; pvTerminal: number; enterpriseValue: number; equityValue: number;
  perShare: number | null; terminalShare: number; valid: boolean; reason?: string;
}

export function dcf(i: DcfInput): DcfResult {
  const rows = [];
  let f = i.fcf0, pvFcf = 0;
  for (let t = 1; t <= i.years; t++) {
    f = f * (1 + i.growth);
    const discount = 1 / (1 + i.wacc) ** t;
    rows.push({ year: t, fcf: f, discount, pv: f * discount });
    pvFcf += f * discount;
  }
  let valid = true, reason: string | undefined;
  if (i.wacc <= i.terminalGrowth) { valid = false; reason = "The discount rate must be higher than terminal growth, or the formula divides by zero or a negative number."; }
  const terminalValue = valid ? (f * (1 + i.terminalGrowth)) / (i.wacc - i.terminalGrowth) : NaN;
  const pvTerminal = terminalValue / (1 + i.wacc) ** i.years;
  const enterpriseValue = pvFcf + pvTerminal;
  const equityValue = enterpriseValue - i.netDebt;
  if (valid && i.fcf0 <= 0) { valid = false; reason = "Base free cash flow is zero or negative, so a growth-based DCF produces a meaningless (negative) value."; }
  return {
    rows, pvFcf, terminalValue, pvTerminal, enterpriseValue, equityValue,
    perShare: i.shares ? equityValue / i.shares : null,
    terminalShare: enterpriseValue ? pvTerminal / enterpriseValue : NaN,
    valid, reason,
  };
}

// ---------- factor exposures (characteristics-based, cross-sectional z-scores) ----------
export interface FactorDef { key: string; label: string; describe: string; value: (c: ModelCompany, price: number | null) => number | null }

export const FACTORS: FactorDef[] = [
  { key: "size", label: "Size", describe: "Natural log of total assets. Bigger companies score higher.", value: (c) => { const a = latestYear(c)?.assets; return isNum(a) && a > 0 ? Math.log(a) : null; } },
  { key: "growth", label: "Growth", describe: "Revenue growth per year over the years on file (compound rate).", value: (c) => { const ys = c.years; const g = cagr(ys[0]?.revenue ?? null, latestYear(c)?.revenue ?? null, ys.length - 1); return isNum(g) ? g : null; } },
  { key: "profitability", label: "Profitability", describe: "Net income divided by revenue in the latest year.", value: (c) => { const y = latestYear(c); return y ? ratio(y.netIncome, y.revenue) : null; } },
  { key: "quality", label: "Quality", describe: "Return on equity: net income divided by shareholders' equity.", value: (c) => { const y = latestYear(c); return y && isNum(y.equity) && y.equity > 0 ? ratio(y.netIncome, y.equity) : null; } },
  { key: "lowLeverage", label: "Low leverage", describe: "Equity as a share of total assets. Less borrowing scores higher.", value: (c) => { const y = latestYear(c); return y ? ratio(y.equity, y.assets) : null; } },
  { key: "stability", label: "Stability", describe: "Negative of the standard deviation of yearly revenue growth. Steadier revenue scores higher.", value: (c) => { const s = stdev(growthRates(c.years.map((y) => y.revenue))); return isNum(s) ? -s : null; } },
  { key: "value", label: "Value", describe: "Earnings yield: diluted EPS divided by share price. Needs a price.", value: (c, price) => { const e = latestYear(c)?.eps; return isNum(e) && price && price > 0 ? e / price : null; } },
];

/** z-score of each company on each factor vs the whole universe (winsorized at ±3). */
export function factorScores(universe: ModelCompany[], prices: Record<number, number | null>) {
  const table: Record<string, { mean: number; sd: number; n: number }> = {};
  for (const f of FACTORS) {
    const vals = universe.map((c) => f.value(c, prices[c.cik] ?? null)).filter(isNum);
    table[f.key] = { mean: mean(vals), sd: stdev(vals), n: vals.length };
  }
  return (c: ModelCompany, price: number | null) =>
    FACTORS.map((f) => {
      const v = f.value(c, price);
      const t = table[f.key];
      const z = isNum(v) && t.n >= 5 && t.sd > 0 ? clamp((v - t.mean) / t.sd, -3, 3) : null;
      const pctRank = isNum(v) ? universe.map((u) => f.value(u, prices[u.cik] ?? null)).filter(isNum).filter((x) => x <= v).length / Math.max(t.n, 1) : null;
      return { key: f.key, label: f.label, describe: f.describe, raw: v, z, pctRank, n: t.n };
    });
}

// ---------- price statistics (only when daily closes exist) ----------
export function dailyReturns(closes: [string, number][]) {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) if (closes[i - 1][1] > 0) r.push(closes[i][1] / closes[i - 1][1] - 1);
  return r;
}
export const annualVol = (r: number[]) => stdev(r) * Math.sqrt(252);
export function maxDrawdown(closes: [string, number][]) {
  let peak = -Infinity, mdd = 0;
  for (const [, p] of closes) { peak = Math.max(peak, p); mdd = Math.min(mdd, p / peak - 1); }
  return mdd;
}
/** Historical 1-day value at risk: the loss exceeded on only (1 - level) of past days. */
export function historicalVaR(r: number[], level = 0.95) {
  if (r.length < 20) return NaN;
  const s = [...r].sort((a, b) => a - b);
  return -s[Math.floor((1 - level) * s.length)];
}
