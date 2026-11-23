"use client";
// Paper trading simulator UI. Pretend money only; state lives in this browser (localStorage), no accounts.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  START_CASH, SPREAD, KEY_STORAGE, SYMBOL_RE, freshState, loadState, saveState, marketOpen, newOrder, tryFill,
  reservedCash, reservedShares, portfolioValue, round2,
  type SimState, type Quote, type Side, type OrderType,
} from "./engine";

const REFRESH_MS = 30_000;
const MAX_SYMBOLS = 25;

const sim = (n: number, digits = 2) =>
  `SIM$${n < 0 ? "-" : ""}${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const tone = (n: number) => (n > 0 ? "text-pos" : n < 0 ? "text-neg" : "");
const when = (t: number) => new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Feed = "checking" | "server" | "own-key" | "none";

async function fetchQuote(symbol: string, feed: Feed, key: string): Promise<Quote | { error: string }> {
  try {
    if (feed === "own-key") {
      const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(key)}`);
      if (r.status === 401 || r.status === 403) return { error: "key" };
      if (r.status === 429) return { error: "rate-limited" };
      const q = await r.json();
      if (!q || typeof q.c !== "number" || q.c <= 0) return { error: "unknown-symbol" };
      return { price: q.c, change: q.d ?? 0, changePct: q.dp ?? 0, prevClose: q.pc, time: q.t * 1000, fetched: Date.now() };
    }
    const r = await fetch(`/api/sim-quote?symbol=${encodeURIComponent(symbol)}`);
    const q = await r.json();
    if (!r.ok) return { error: q?.error ?? "upstream" };
    return { price: q.price, change: q.change ?? 0, changePct: q.changePct ?? 0, prevClose: q.prevClose, time: q.time * 1000, fetched: Date.now() };
  } catch {
    return { error: "network" };
  }
}

export default function Simulator() {
  const [state, setState] = useState<SimState | null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feed, setFeed] = useState<Feed>("checking");
  const [key, setKey] = useState("");
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const quotesRef = useRef(quotes);
  quotesRef.current = quotes;

  // Load saved portfolio and feed settings once, in the browser.
  useEffect(() => {
    setState(loadState());
    setOpen(marketOpen());
    let saved = "";
    try { saved = localStorage.getItem(KEY_STORAGE) ?? ""; } catch { /* ignore */ }
    if (saved) { setKey(saved); setFeed("own-key"); return; }
    fetch("/api/sim-quote?symbol=SPY").then((r) => setFeed(r.status === 503 ? "none" : "server")).catch(() => setFeed("none"));
  }, []);

  useEffect(() => { if (state) saveState(state); }, [state]);

  const symbols = useMemo(() => {
    if (!state) return [] as string[];
    const set = new Set<string>([...state.watch, ...Object.keys(state.positions), ...state.orders.filter((o) => o.status === "pending").map((o) => o.symbol)]);
    return [...set].slice(0, MAX_SYMBOLS);
  }, [state]);

  const refresh = useCallback(async (extra: string[] = []) => {
    if (feed !== "server" && feed !== "own-key") return;
    const list = [...new Set([...symbols, ...extra])];
    const results = await Promise.all(list.map(async (s) => [s, await fetchQuote(s, feed, key)] as const));
    const nextQ: Record<string, Quote> = { ...quotesRef.current };
    const nextE: Record<string, string> = {};
    for (const [s, r] of results) { if ("error" in r) nextE[s] = r.error; else nextQ[s] = r; }
    setQuotes(nextQ);
    setErrors(nextE);
    setLastRefresh(Date.now());
    const isOpen = marketOpen();
    setOpen(isOpen);
    // Work the pending orders against the new prices, then record the portfolio value for the chart.
    setState((s) => {
      if (!s) return s;
      let n = s;
      for (const o of s.orders) if (o.status === "pending") n = tryFill(n, n.orders.find((x) => x.id === o.id)!, nextQ[o.symbol], isOpen);
      const v = portfolioValue(n, nextQ);
      const last = n.history[n.history.length - 1];
      if (v !== null && (!last || Date.now() - last.t > 60_000)) n = { ...n, history: [...n.history, { t: Date.now(), v: round2(v) }].slice(-2000) };
      return n;
    });
  }, [feed, key, symbols]);

  useEffect(() => {
    if (feed !== "server" && feed !== "own-key") return;
    refresh();
    const id = setInterval(() => refresh(), REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, key, symbols.join(",")]);

  if (!state) return <p className="text-muted">Loading the simulator…</p>;

  const value = portfolioValue(state, quotes);
  const reserved = reservedCash(state, quotes);
  const unrealized = Object.entries(state.positions).reduce((sum, [s, p]) => sum + (quotes[s] ? quotes[s].price * p.qty - p.cost : 0), 0);

  return (
    <div className="space-y-8">
      <SimBanner />

      {!state.ack ? (
        <AckGate onAccept={() => setState({ ...state, ack: true })} />
      ) : (
        <>
          <FeedPanel feed={feed} keyValue={key} lastRefresh={lastRefresh} open={open}
            onSaveKey={(k) => { try { localStorage.setItem(KEY_STORAGE, k); } catch { /* ignore */ } setKey(k); setFeed("own-key"); }}
            onClearKey={() => { try { localStorage.removeItem(KEY_STORAGE); } catch { /* ignore */ } setKey(""); setFeed("checking");
              fetch("/api/sim-quote?symbol=SPY").then((r) => setFeed(r.status === 503 ? "none" : "server")).catch(() => setFeed("none")); }}
            onRefresh={() => refresh()} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Box label="Simulated account value" value={value === null ? "waiting for prices" : sim(value)}
              sub={value === null ? undefined : `${pct(((value - START_CASH) / START_CASH) * 100)} since start`} toneN={value === null ? 0 : value - START_CASH} />
            <Box label="Pretend cash" value={sim(state.cash)} sub={reserved > 0 ? `${sim(reserved)} held for open buy orders` : "Not real money"} />
            <Box label="Unrealized gain/loss" value={sim(unrealized)} toneN={unrealized} sub="On shares you still hold" />
            <Box label="Realized gain/loss" value={sim(state.realized)} toneN={state.realized} sub="From shares you sold" />
          </div>

          <ValueChart history={state.history} />

          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6">
            <OrderTicket state={state} quotes={quotes} errors={errors} open={open} feedReady={feed === "server" || feed === "own-key"}
              onLookup={(s) => refresh([s])}
              onPlace={(o) => {
                setState((s) => {
                  if (!s) return s;
                  let n = { ...s, orders: [newOrder(o), ...s.orders], watch: s.watch.includes(o.symbol) ? s.watch : [...s.watch, o.symbol] };
                  n = tryFill(n, n.orders[0], quotesRef.current[o.symbol], marketOpen());
                  return n;
                });
              }} />
            <Watchlist state={state} quotes={quotes} errors={errors}
              onAdd={(s) => { setState({ ...state, watch: [...state.watch, s] }); refresh([s]); }}
              onRemove={(s) => setState({ ...state, watch: state.watch.filter((w) => w !== s) })} />
          </div>

          <Positions state={state} quotes={quotes} />
          <Orders state={state} onCancel={(id) => setState({ ...state, orders: state.orders.map((o) => (o.id === id && o.status === "pending" ? { ...o, status: "cancelled" } : o)) })} />
          <ResetBox onReset={() => setState(freshState(true))} createdAt={state.createdAt} />
        </>
      )}

      <HowItWorks />
    </div>
  );
}

function SimBanner() {
  return (
    <>
    <p aria-hidden className="sticky top-0 z-10 -mx-4 bg-neg px-4 py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-paper">
      Simulator · Fake money (SIM$) · Not a broker
    </p>
    <div role="note" className="rounded-md border-2 border-dashed border-neg bg-warn-soft px-4 py-3 text-sm">
      <p className="font-semibold text-neg uppercase tracking-wide text-xs">Simulator · Fake money · Not a broker</p>
      <p className="mt-1 text-ink">
        Every dollar on this page is pretend <strong>SIM$</strong> with no cash value. No order is sent to any broker or stock exchange,
        and you cannot deposit, withdraw or win real money. Prices come from a public data feed; the trades do not. Not investment advice.
      </p>
    </div>
    </>
  );
}

function AckGate({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <section className="rounded-md border border-rule bg-card p-5 max-w-2xl">
      <h2 className="font-serif text-xl font-semibold">Before you start</h2>
      <ul className="mt-3 list-disc pl-5 space-y-1.5 text-sm leading-relaxed">
        <li>This is a <strong>practice simulator</strong>. You get SIM$100,000 of pretend money that is worth nothing.</li>
        <li>Charlotte Business Tracker is <strong>not a broker</strong> and never handles real money, accounts or orders.</li>
        <li>Prices are real quotes from a public feed, but your trades are imaginary. Real trading has costs, delays and risks this page leaves out.</li>
        <li>Your simulated portfolio is saved only in this browser. Nobody else can see it, and clearing site data erases it.</li>
        <li>Nothing here is a recommendation to buy or sell any security.</li>
      </ul>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1" />
        <span>I understand this is a simulator with fake money, not a real brokerage account.</span>
      </label>
      <button type="button" disabled={!checked} onClick={onAccept}
        className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper disabled:opacity-40">Start the simulator</button>
    </section>
  );
}

function FeedPanel({ feed, keyValue, lastRefresh, open, onSaveKey, onClearKey, onRefresh }: {
  feed: Feed; keyValue: string; lastRefresh: number | null; open: boolean;
  onSaveKey: (k: string) => void; onClearKey: () => void; onRefresh: () => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <section className="rounded-md border border-rule bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={`inline-flex items-center gap-1.5 font-medium ${open ? "text-pos" : "text-muted"}`}>
          <span aria-hidden className={`h-2 w-2 rounded-full ${open ? "bg-pos" : "bg-muted"}`} />
          {open ? "US market open (simulated orders can fill)" : "US market closed (orders wait until 9:30 a.m. ET)"}
        </span>
        {feed === "server" && <span className="text-muted">Prices: Finnhub, via this site</span>}
        {feed === "own-key" && <span className="text-muted">Prices: Finnhub, with your own free key{keyValue ? ` (…${keyValue.slice(-4)})` : ""}</span>}
        {lastRefresh && <span className="text-muted">Updated {new Date(lastRefresh).toLocaleTimeString("en-US")} · refreshes every 30 s</span>}
        {(feed === "server" || feed === "own-key") && <button type="button" onClick={onRefresh} className="text-accent underline">Refresh now</button>}
        {feed === "own-key" && <button type="button" onClick={onClearKey} className="text-muted underline">Remove my key</button>}
      </div>
      {feed === "checking" && <p className="mt-2 text-muted">Checking for a price feed…</p>}
      {feed === "none" && (
        <div className="mt-3">
          <p className="leading-relaxed">
            <strong>Connect a free price feed to start trading.</strong> This simulator uses quotes from{" "}
            <a href="https://finnhub.io/register" target="_blank" rel="noopener noreferrer" className="text-accent underline">Finnhub</a>.
            Create a free account there, copy your API key, and paste it below. The key is stored only in this browser and is sent only to
            Finnhub, never to this site.
          </p>
          <form className="mt-3 flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) onSaveKey(draft.trim()); }}>
            <label htmlFor="fh-key" className="sr-only">Finnhub API key</label>
            <input id="fh-key" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your free Finnhub API key" autoComplete="off"
              className="flex-1 rounded-md border border-rule bg-paper px-3 py-2 outline-none focus:border-accent" />
            <button type="submit" className="rounded-md bg-accent px-4 py-2 font-medium text-paper">Use this key</button>
          </form>
        </div>
      )}
    </section>
  );
}

function Box({ label, value, sub, toneN = 0 }: { label: string; value: string; sub?: string; toneN?: number }) {
  return (
    <div className="rounded-md border border-rule bg-card p-4 min-w-0">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-lg sm:text-2xl font-semibold num break-words ${tone(toneN)}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function ValueChart({ history }: { history: { t: number; v: number }[] }) {
  if (history.length < 2) {
    return <p className="text-sm text-muted">The account value chart starts once prices load and the simulator records a second reading (about once a minute while this page is open).</p>;
  }
  const W = 800, H = 200, P = 8;
  const t0 = history[0].t, t1 = history[history.length - 1].t;
  const vs = history.map((h) => h.v).concat(START_CASH);
  const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const x = (t: number) => P + ((t - t0) / (t1 - t0 || 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / span) * (H - 2 * P);
  const d = history.map((h, i) => `${i ? "L" : "M"}${x(h.t).toFixed(1)},${y(h.v).toFixed(1)}`).join(" ");
  const up = history[history.length - 1].v >= START_CASH;
  return (
    <figure className="rounded-md border border-rule bg-card p-4">
      <figcaption className="flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>Simulated account value (SIM$), recorded while this page was open</span>
        <span>{sim(lo, 0)} to {sim(hi, 0)} · dashed line = SIM$100,000 start</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full h-40" preserveAspectRatio="none" role="img" aria-label="Line chart of simulated account value over time">
        <line x1={P} x2={W - P} y1={y(START_CASH)} y2={y(START_CASH)} stroke="var(--rule)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke={up ? "var(--pos)" : "var(--neg)"} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="mt-1 flex justify-between text-xs text-muted"><span>{when(t0)}</span><span>{when(t1)}</span></p>
    </figure>
  );
}

function OrderTicket({ state, quotes, errors, open, feedReady, onLookup, onPlace }: {
  state: SimState; quotes: Record<string, Quote>; errors: Record<string, string>; open: boolean; feedReady: boolean;
  onLookup: (s: string) => void;
  onPlace: (o: { symbol: string; side: Side; type: OrderType; qty: number; limit?: number }) => void;
}) {
  const [symbol, setSymbol] = useState("BAC");
  const [side, setSide] = useState<Side>("buy");
  const [type, setType] = useState<OrderType>("market");
  const [qty, setQty] = useState("10");
  const [limit, setLimit] = useState("");
  const [review, setReview] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sym = symbol.trim().toUpperCase();
  const q = quotes[sym];
  const n = Math.floor(Number(qty));
  const lim = Number(limit);
  const px = type === "limit" ? lim : q ? q.price * (1 + (side === "buy" ? SPREAD : -SPREAD)) : NaN;
  const est = n * px;
  const held = state.positions[sym]?.qty ?? 0;
  const sellable = held - reservedShares(state, sym);
  const buyingPower = state.cash - reservedCash(state, quotes);

  let problem: string | null = null;
  if (!feedReady) problem = "Connect a price feed first.";
  else if (!SYMBOL_RE.test(sym)) problem = "Enter a US stock ticker, like BAC.";
  else if (errors[sym] === "unknown-symbol") problem = `No quote found for ${sym}.`;
  else if (!q) problem = `Look up ${sym} to get a price.`;
  else if (!Number.isInteger(n) || n < 1) problem = "Shares must be a whole number of at least 1.";
  else if (type === "limit" && !(lim > 0)) problem = "Enter a limit price.";
  else if (side === "buy" && est > buyingPower) problem = `That costs about ${sim(est)}, more than your ${sim(buyingPower)} of pretend buying power.`;
  else if (side === "sell" && n > sellable) problem = `You can sell at most ${Math.max(0, sellable)} ${sym} shares (short selling is not simulated).`;

  return (
    <section className="rounded-md border border-rule bg-card p-4 min-w-0">
      <h2 className="font-serif text-xl font-semibold">Simulated order ticket</h2>
      <p className="text-xs text-muted mt-1">Practice only. This form never contacts a broker.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <label className="col-span-2">
          <span className="text-xs text-muted">Ticker</span>
          <div className="mt-1 flex gap-2">
            <input value={symbol} onChange={(e) => { setSymbol(e.target.value.toUpperCase()); setReview(false); }} maxLength={10}
              className="flex-1 min-w-0 rounded-md border border-rule bg-paper px-3 py-2 uppercase outline-none focus:border-accent" />
            <button type="button" disabled={!feedReady || !SYMBOL_RE.test(sym)} onClick={() => onLookup(sym)}
              className="rounded-md border border-rule px-3 py-2 disabled:opacity-40">Get quote</button>
          </div>
        </label>
        {q && (
          <p className="col-span-2 num">
            <span className="text-lg font-semibold">${q.price.toFixed(2)}</span>{" "}
            <span className={tone(q.change)}>{q.change >= 0 ? "+" : ""}{q.change.toFixed(2)} ({pct(q.changePct)})</span>
            <span className="block text-xs text-muted">Real last price, as of {when(q.time)} · previous close ${q.prevClose?.toFixed(2)}</span>
          </p>
        )}
        <Seg label="Action" value={side} options={[["buy", "Buy"], ["sell", "Sell"]]} onChange={(v) => { setSide(v as Side); setReview(false); }} />
        <Seg label="Order type" value={type} options={[["market", "Market"], ["limit", "Limit"]]} onChange={(v) => { setType(v as OrderType); setReview(false); }} />
        <label>
          <span className="text-xs text-muted">Shares</span>
          <input inputMode="numeric" value={qty} onChange={(e) => { setQty(e.target.value); setReview(false); }}
            className="mt-1 w-full rounded-md border border-rule bg-paper px-3 py-2 num outline-none focus:border-accent" />
        </label>
        {type === "limit" ? (
          <label>
            <span className="text-xs text-muted">Limit price ($)</span>
            <input inputMode="decimal" value={limit} onChange={(e) => { setLimit(e.target.value); setReview(false); }} placeholder={q ? q.price.toFixed(2) : ""}
              className="mt-1 w-full rounded-md border border-rule bg-paper px-3 py-2 num outline-none focus:border-accent" />
          </label>
        ) : <div />}
      </div>

      <p className="mt-3 text-xs text-muted num">
        Pretend buying power: {sim(buyingPower)}{held ? ` · You hold ${held} ${sym}` : ""}
        {q && Number.isFinite(est) && n > 0 ? ` · Estimated ${side === "buy" ? "cost" : "proceeds"}: ${sim(est)}` : ""}
      </p>

      {problem ? (
        <p className="mt-3 text-sm text-neg">{problem}</p>
      ) : !review ? (
        <button type="button" onClick={() => { setReview(true); setMsg(null); }} className="mt-3 w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper">
          Review simulated order
        </button>
      ) : (
        <div className="mt-3 rounded-md border border-accent bg-accent-soft p-3 text-sm">
          <p>
            <strong>{side === "buy" ? "Buy" : "Sell"} {n} {sym}</strong> {type === "market" ? "at the market" : `with a limit of $${lim.toFixed(2)}`}, using pretend SIM$.
            {!open && " The market is closed, so this simulated order will wait and try to fill after 9:30 a.m. ET."}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => { onPlace({ symbol: sym, side, type, qty: n, limit: type === "limit" ? lim : undefined }); setReview(false); setMsg(`Simulated order placed: ${side} ${n} ${sym}. Check "Simulated orders" below.`); }}
              className="rounded-md bg-accent px-4 py-2 font-medium text-paper">Place simulated order</button>
            <button type="button" onClick={() => setReview(false)} className="rounded-md border border-rule px-4 py-2">Edit</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-pos">{msg}</p>}
    </section>
  );
}

function Seg({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="text-xs text-muted">{label}</legend>
      <div className="mt-1 grid grid-cols-2 rounded-md border border-rule overflow-hidden">
        {options.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
            className={`px-3 py-2 ${value === v ? "bg-accent text-paper font-medium" : "bg-paper"}`}>{l}</button>
        ))}
      </div>
    </fieldset>
  );
}

function Watchlist({ state, quotes, errors, onAdd, onRemove }: {
  state: SimState; quotes: Record<string, Quote>; errors: Record<string, string>; onAdd: (s: string) => void; onRemove: (s: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <section className="rounded-md border border-rule bg-card p-4 min-w-0">
      <h2 className="font-serif text-xl font-semibold">Watchlist</h2>
      <p className="text-xs text-muted mt-1">Starts with large companies based in or near Charlotte, plus SPY (an S&amp;P 500 fund) as a benchmark.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm num">
          <thead><tr className="text-left text-xs uppercase text-muted"><th className="py-1.5 pr-3">Ticker</th><th className="pr-3 text-right">Last</th><th className="pr-3 text-right">Today</th><th /></tr></thead>
          <tbody>
            {state.watch.map((s) => {
              const q = quotes[s];
              return (
                <tr key={s} className="border-t border-rule">
                  <td className="py-1.5 pr-3 font-medium">{s}</td>
                  <td className="pr-3 text-right">{q ? `$${q.price.toFixed(2)}` : errors[s] === "unknown-symbol" ? "not found" : "…"}</td>
                  <td className={`pr-3 text-right ${q ? tone(q.change) : ""}`}>{q ? pct(q.changePct) : ""}</td>
                  <td className="text-right"><button type="button" onClick={() => onRemove(s)} className="text-xs text-muted underline" aria-label={`Remove ${s}`}>remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); const s = draft.trim().toUpperCase(); if (SYMBOL_RE.test(s) && !state.watch.includes(s) && state.watch.length < 20) { onAdd(s); setDraft(""); } }}>
        <label htmlFor="watch-add" className="sr-only">Add ticker</label>
        <input id="watch-add" value={draft} onChange={(e) => setDraft(e.target.value.toUpperCase())} placeholder="Add ticker" maxLength={10}
          className="flex-1 min-w-0 rounded-md border border-rule bg-paper px-3 py-2 text-sm uppercase outline-none focus:border-accent" />
        <button type="submit" className="rounded-md border border-rule px-3 py-2 text-sm">Add</button>
      </form>
    </section>
  );
}

function Positions({ state, quotes }: { state: SimState; quotes: Record<string, Quote> }) {
  const rows = Object.entries(state.positions);
  return (
    <section>
      <h2 className="font-serif text-xl font-semibold border-b border-rule pb-2 mb-3">Simulated holdings</h2>
      {rows.length === 0 ? <p className="text-sm text-muted">No pretend shares yet. Place a simulated buy order above.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm num">
            <thead><tr className="text-left text-xs uppercase text-muted">
              <th className="py-1.5 pr-3">Ticker</th><th className="pr-3 text-right">Shares</th><th className="pr-3 text-right">Avg cost</th>
              <th className="pr-3 text-right">Last</th><th className="pr-3 text-right">Value</th><th className="pr-3 text-right">Gain/loss</th>
            </tr></thead>
            <tbody>
              {rows.map(([s, p]) => {
                const q = quotes[s];
                const val = q ? q.price * p.qty : null;
                const gl = val === null ? null : val - p.cost;
                return (
                  <tr key={s} className="border-t border-rule">
                    <td className="py-1.5 pr-3 font-medium">{s}</td>
                    <td className="pr-3 text-right">{p.qty}</td>
                    <td className="pr-3 text-right">${(p.cost / p.qty).toFixed(2)}</td>
                    <td className="pr-3 text-right">{q ? `$${q.price.toFixed(2)}` : "…"}</td>
                    <td className="pr-3 text-right">{val === null ? "…" : sim(val)}</td>
                    <td className={`pr-3 text-right ${gl === null ? "" : tone(gl)}`}>{gl === null ? "…" : `${sim(gl)} (${pct((gl / p.cost) * 100)})`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Orders({ state, onCancel }: { state: SimState; onCancel: (id: string) => void }) {
  return (
    <section>
      <h2 className="font-serif text-xl font-semibold border-b border-rule pb-2 mb-3">Simulated orders</h2>
      {state.orders.length === 0 ? <p className="text-sm text-muted">No simulated orders yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm num">
            <thead><tr className="text-left text-xs uppercase text-muted">
              <th className="py-1.5 pr-3">Placed</th><th className="pr-3">Order</th><th className="pr-3">Status</th><th className="pr-3 text-right">Fill price</th><th />
            </tr></thead>
            <tbody>
              {state.orders.slice(0, 100).map((o) => (
                <tr key={o.id} className="border-t border-rule align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{when(o.created)}</td>
                  <td className="pr-3 whitespace-nowrap">{o.side === "buy" ? "Buy" : "Sell"} {o.qty} {o.symbol} · {o.type === "market" ? "market" : `limit $${o.limit!.toFixed(2)}`}</td>
                  <td className="pr-3">
                    <span className={o.status === "filled" ? "text-pos" : o.status === "rejected" ? "text-neg" : "text-muted"}>{o.status}</span>
                    {o.filledAt && <span className="block text-xs text-muted">{when(o.filledAt)}</span>}
                    {o.note && <span className="block text-xs text-muted">{o.note}</span>}
                  </td>
                  <td className="pr-3 text-right">{o.fillPrice ? `$${o.fillPrice.toFixed(2)}` : ""}</td>
                  <td className="text-right">{o.status === "pending" && <button type="button" onClick={() => onCancel(o.id)} className="text-xs text-accent underline">cancel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ResetBox({ onReset, createdAt }: { onReset: () => void; createdAt: number }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <section className="text-sm text-muted">
      Simulation started {when(createdAt)}.{" "}
      {!confirm ? <button type="button" onClick={() => setConfirm(true)} className="underline">Reset to SIM$100,000</button> : (
        <span>Erase all simulated holdings and orders? <button type="button" onClick={() => { onReset(); setConfirm(false); }} className="text-neg underline">Yes, reset</button>{" "}
          <button type="button" onClick={() => setConfirm(false)} className="underline">Keep them</button></span>
      )}
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="rounded-md border border-rule bg-card p-5 text-sm leading-relaxed">
      <h2 className="font-serif text-xl font-semibold">How the simulator works</h2>
      <ul className="mt-3 list-disc pl-5 space-y-1.5">
        <li><strong>Prices are real; trades are not.</strong> Quotes come from Finnhub&apos;s free quote service for US stocks and refresh every 30 seconds while this page is open. Your orders exist only in your browser.</li>
        <li><strong>Market orders</strong> fill at the latest price plus a simulated 0.05% spread (you pay slightly more to buy and get slightly less when you sell), like a real bid/ask spread. Commissions are SIM$0.</li>
        <li><strong>Limit orders</strong> wait until the price reaches your limit, checked each time prices refresh while this page is open.</li>
        <li><strong>Market hours:</strong> orders fill only from 9:30 a.m. to 4 p.m. Eastern, Monday to Friday. Orders placed outside those hours wait. On exchange holidays nothing fills, because the feed shows no fresh trades. Pre-market and after-hours trading are not simulated.</li>
        <li><strong>Not simulated:</strong> short selling, margin, options, dividends, stock splits, taxes, partial fills and the market impact of large orders. Real results would differ.</li>
        <li><strong>Your data:</strong> the simulated portfolio is saved in this browser only (local storage). This site does not see or store it.</li>
      </ul>
      <p className="mt-3 text-xs text-muted">Charlotte Business Tracker is an educational project, not a broker-dealer or investment adviser. Nothing on this page is investment advice or an offer to buy or sell any security.</p>
    </section>
  );
}
