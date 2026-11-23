"use client";
// The /models workbench: pick one or two companies, then run any of the models on them.
import { useEffect, useMemo, useRef, useState } from "react";
import { type ModelCompany, type PricePoint, impliedShares } from "@/lib/models";
import { perShare } from "@/lib/format";
import { NumField } from "./parts";
import Compare from "./Compare";
import ThreeStatement from "./ThreeStatement";
import Dcf from "./Dcf";
import Comps from "./Comps";
import Sotp from "./Sotp";
import Scenario from "./Scenario";
import Factor from "./Factor";
import Risk from "./Risk";
import Quant from "./Quant";

export interface Side { c: ModelCompany; price: number | null; priceNote: string; shares: number | null; sharesNote: string }
export interface ModelProps { a: Side; b: Side | null; universe: ModelCompany[]; priceOf: (c: ModelCompany) => number | null }

const TABS = [
  { key: "compare", label: "Compare", C: Compare },
  { key: "three-statement", label: "Three-statement", C: ThreeStatement },
  { key: "dcf", label: "DCF", C: Dcf },
  { key: "comps", label: "Comparable companies", C: Comps },
  { key: "sotp", label: "Sum of the parts", C: Sotp },
  { key: "scenarios", label: "Scenarios & sensitivity", C: Scenario },
  { key: "factors", label: "Factor model", C: Factor },
  { key: "risk", label: "Risk & position sizing", C: Risk },
  { key: "quant", label: "Quant & statistics", C: Quant },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function ModelLab({ universe, defaultA, defaultB }: { universe: ModelCompany[]; defaultA: number; defaultB: number }) {
  const [aCik, setA] = useState<number>(defaultA);
  const [bCik, setB] = useState<number | null>(defaultB);
  const [tab, setTab] = useState<TabKey>("compare");
  const [priceOverride, setPriceOverride] = useState<Record<number, number | null>>({});
  const [shareOverride, setShareOverride] = useState<Record<number, number | null>>({});
  const [live, setLive] = useState<Record<number, PricePoint | "none">>({});
  const tried = useRef<Set<number>>(new Set());

  // Read and write ?a=&b=&model= so a comparison can be shared as a link.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const find = (v: string | null) => (v ? universe.find((c) => String(c.cik) === v || c.ticker?.toLowerCase() === v.toLowerCase())?.cik : undefined);
    const a = find(p.get("a")), b = find(p.get("b"));
    if (a) setA(a);
    if (p.get("b") === "none") setB(null); else if (b) setB(b);
    const m = p.get("model");
    if (m && TABS.some((t) => t.key === m)) setTab(m as TabKey);
  }, [universe]);
  useEffect(() => {
    const p = new URLSearchParams();
    const tick = (cik: number) => universe.find((c) => c.cik === cik)?.ticker ?? String(cik);
    p.set("a", tick(aCik));
    p.set("b", bCik ? tick(bCik) : "none");
    p.set("model", tab);
    window.history.replaceState(null, "", `?${p.toString()}`);
  }, [aCik, bCik, tab, universe]);

  // Try a live quote (served by the site's own quote route when it's configured). Silent fallback.
  useEffect(() => {
    for (const cik of [aCik, bCik]) {
      if (!cik || tried.current.has(cik)) continue;
      tried.current.add(cik);
      const t = universe.find((c) => c.cik === cik)?.ticker;
      if (!t) continue;
      fetch(`/api/sim-quote?symbol=${encodeURIComponent(t)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((q) => {
          const price = q && typeof q.price === "number" && q.price > 0 ? q.price : null;
          setLive((l) => ({ ...l, [cik]: price ? { value: price, date: q.time ? new Date(q.time * (q.time < 1e12 ? 1000 : 1)).toISOString().slice(0, 10) : "today", source: "live quote" } : "none" }));
        })
        .catch(() => setLive((l) => ({ ...l, [cik]: "none" })));
    }
  }, [aCik, bCik, universe]);

  const priceInfo = (c: ModelCompany): { price: number | null; note: string } => {
    const o = priceOverride[c.cik];
    if (o != null) return { price: o, note: "Price you entered." };
    const l = live[c.cik];
    if (l && l !== "none") return { price: l.value, note: `Live quote, ${l.date}. Delayed market data, may be minutes old.` };
    if (c.lastClose) return { price: c.lastClose.value, note: `Closing price ${c.lastClose.date} (${c.lastClose.source}).` };
    return { price: null, note: "No price on file. Enter one to unlock price-based measures." };
  };
  const priceOf = (c: ModelCompany) => priceInfo(c).price;

  const side = (cik: number | null): Side | null => {
    const c = cik ? universe.find((x) => x.cik === cik) : undefined;
    if (!c) return null;
    const p = priceInfo(c);
    const so = shareOverride[c.cik];
    const est = impliedShares(c);
    return {
      c, price: p.price, priceNote: p.note,
      shares: so ?? est,
      sharesNote: so != null ? "Share count you entered." : est ? "Estimated: latest net income ÷ diluted EPS from the annual report. Can be off when EPS is small." : "Couldn't estimate (no EPS on file). Enter the diluted share count from the 10-K cover page.",
    };
  };
  const a = side(aCik)!;
  const b = side(bCik);
  const Active = TABS.find((t) => t.key === tab)!.C;

  return (
    <div className="min-w-0">
      <div className="grid gap-4 md:grid-cols-2">
        <SidePanel label="Company A" color="var(--accent)" universe={universe} side={a} onPick={setA}
          onPrice={(v) => setPriceOverride((o) => ({ ...o, [a.c.cik]: v }))} onShares={(v) => setShareOverride((o) => ({ ...o, [a.c.cik]: v }))} />
        {b ? (
          <SidePanel label="Company B" color="var(--series-b)" universe={universe} side={b} onPick={setB} onClear={() => setB(null)}
            onPrice={(v) => setPriceOverride((o) => ({ ...o, [b.c.cik]: v }))} onShares={(v) => setShareOverride((o) => ({ ...o, [b.c.cik]: v }))} />
        ) : (
          <div className="rounded-md border border-dashed border-rule p-4 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted mb-2">Company B (optional)</p>
            <Picker universe={universe} onPick={setB} placeholder="Add a second company to compare" />
          </div>
        )}
      </div>

      <nav aria-label="Models" className="mt-8 -mx-4 overflow-x-auto px-4 border-b border-rule">
        <ul className="flex gap-1 whitespace-nowrap text-sm">
          {TABS.map((t) => (
            <li key={t.key}>
              <button type="button" onClick={() => setTab(t.key)} aria-current={tab === t.key ? "page" : undefined}
                className={`px-3 py-2 -mb-px border-b-2 ${tab === t.key ? "border-accent text-ink font-medium" : "border-transparent text-muted hover:text-ink"}`}>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 min-w-0">
        <Active key={`${tab}-${aCik}-${bCik}`} a={a} b={b} universe={universe} priceOf={priceOf} />
      </div>
    </div>
  );
}

function SidePanel({ label, color, universe, side, onPick, onClear, onPrice, onShares }: {
  label: string; color: string; universe: ModelCompany[]; side: Side; onPick: (cik: number) => void; onClear?: () => void;
  onPrice: (v: number | null) => void; onShares: (v: number | null) => void;
}) {
  const { c } = side;
  const last = c.years[c.years.length - 1];
  return (
    <div className="rounded-md border border-rule bg-card p-4 min-w-0" style={{ borderTop: `3px solid ${color}` }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        {onClear && <button type="button" onClick={onClear} className="text-xs text-muted hover:text-ink underline">Remove</button>}
      </div>
      <p className="mt-1 font-serif text-xl font-semibold leading-tight">{c.name} {c.ticker && <span className="text-muted text-base font-sans">({c.ticker})</span>}</p>
      <p className="text-xs text-muted mt-0.5">{c.industry || "Industry not listed"} · {c.city} · latest annual report FY{last?.end.slice(0, 4)}</p>
      <div className="mt-3"><Picker universe={universe} onPick={onPick} placeholder="Switch company: name or ticker" /></div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <NumField label="Share price" prefix="$" step={0.01} value={side.price} onChange={onPrice} hint={side.priceNote} />
        <NumField label="Diluted shares (millions)" step={0.1} value={side.shares != null ? side.shares / 1e6 : null} onChange={(v) => onShares(v == null ? null : v * 1e6)} hint={side.sharesNote} />
      </div>
      {side.price != null && side.shares != null && (
        <p className="mt-2 text-xs text-muted">Market value at this price: <span className="num text-ink">${((side.price * side.shares) / 1e9).toFixed(2)}B</span> ({perShare(side.price)} × {(side.shares / 1e6).toFixed(1)}M shares)</p>
      )}
    </div>
  );
}

export function Picker({ universe, onPick, placeholder }: { universe: ModelCompany[]; onPick: (cik: number) => void; placeholder: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? universe.filter((c) => c.name.toLowerCase().includes(s) || c.ticker?.toLowerCase().startsWith(s) || c.industry.toLowerCase().includes(s) || c.city.toLowerCase().includes(s)) : universe;
    return list.slice(0, 12);
  }, [q, universe]);
  return (
    <div className="relative">
      <input
        type="search" value={q} placeholder={placeholder} aria-label={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { onPick(matches[0].cik); setQ(""); setOpen(false); } }}
        className="w-full rounded border border-rule bg-paper px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded border border-rule bg-card shadow-lg text-sm">
          {matches.map((c) => (
            <li key={c.cik}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(c.cik); setQ(""); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-accent-soft">
                <span className="font-medium">{c.name}</span> {c.ticker && <span className="text-muted">{c.ticker}</span>}
                <span className="block text-[11px] text-muted truncate">{c.industry || "—"} · {c.city}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
