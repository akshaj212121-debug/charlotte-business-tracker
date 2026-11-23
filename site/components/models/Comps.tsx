"use client";
import { useMemo, useState } from "react";
import { money, pct, perShare, signedPct, times } from "@/lib/format";
import { impliedShares, isNum, latestYear, median, type ModelCompany } from "@/lib/models";
import { metrics } from "./Compare";
import { BarGroups } from "./charts";
import { Explainer, Note, ScrollTable } from "./parts";
import { Picker, type ModelProps, type Side } from "./ModelLab";
import { useWhich } from "./which";

export default function Comps(props: ModelProps) {
  const { s, control } = useWhich(props.a, props.b);
  return <Inner key={s.c.cik} {...props} s={s} control={control} />;
}

function defaultPeers(target: ModelCompany, other: ModelCompany | null, universe: ModelCompany[]) {
  const sic2 = target.sic.slice(0, 2);
  const same = universe.filter((c) => c.cik !== target.cik && c.cik !== other?.cik && c.sic && c.sic.slice(0, 2) === sic2)
    .sort((x, y) => (latestYear(y)?.revenue ?? 0) - (latestYear(x)?.revenue ?? 0));
  return [...(other && other.cik !== target.cik ? [other.cik] : []), ...same.slice(0, 5).map((c) => c.cik)];
}

function Inner({ s, a, b, universe, priceOf, control }: ModelProps & { s: Side; control: React.ReactNode }) {
  const other = s === a ? b?.c ?? null : a.c;
  const [peerCiks, setPeers] = useState<number[]>(() => defaultPeers(s.c, other, universe));
  const [prices, setPrices] = useState<Record<number, number | null>>({});
  const peers = peerCiks.map((cik) => universe.find((c) => c.cik === cik)!).filter(Boolean);
  const peerSides: Side[] = peers.map((c) => ({ c, price: prices[c.cik] !== undefined ? prices[c.cik] : priceOf(c), priceNote: "", shares: impliedShares(c), sharesNote: "" }));
  const pm = peerSides.map(metrics);
  const tm = metrics(s);
  const med = useMemo(() => ({
    pe: median(pm.map((x) => x.pe).filter(isNum)), pb: median(pm.map((x) => x.pb).filter(isNum)),
    evRevenue: median(pm.map((x) => x.evRevenue).filter(isNum)), evEbit: median(pm.map((x) => x.evEbit).filter(isNum)),
    netMargin: median(pm.map((x) => x.netMargin).filter(isNum)), roe: median(pm.map((x) => x.roe).filter(isNum)),
    revenueGrowth: median(pm.map((x) => x.revenueGrowth).filter(isNum)),
  }), [pm]);

  const y = latestYear(s.c);
  const nd = tm.netDebt ?? 0;
  const sh = s.shares;
  const implied = [
    { label: "P/E × EPS", value: isNum(med.pe) && isNum(y?.eps) && y.eps > 0 ? med.pe * y.eps : null, multiple: med.pe },
    { label: "P/B × book value", value: isNum(med.pb) && sh && isNum(y?.equity) && y.equity > 0 ? (med.pb * y.equity) / sh : null, multiple: med.pb },
    { label: "EV/Revenue", value: isNum(med.evRevenue) && sh && isNum(y?.revenue) ? (med.evRevenue * y.revenue - nd) / sh : null, multiple: med.evRevenue },
    { label: "EV/Operating income", value: isNum(med.evEbit) && sh && isNum(y?.operatingIncome) && y.operatingIncome > 0 ? (med.evEbit * y.operatingIncome - nd) / sh : null, multiple: med.evEbit },
  ];
  const pricedPeers = peerSides.filter((p) => p.price != null).length;

  return (
    <div>
      {control}
      <p className="text-sm text-muted mb-3">Valuing <b className="text-ink">{s.c.name}</b> against the peer group below. Peers start as {other ? `${other.ticker ?? other.name} plus ` : ""}the largest North Carolina filers in the same industry group (first two digits of the SEC industry code). Add or remove any.</p>
      {pricedPeers < 2 && <div className="mb-3"><Note tone="warn">Valuation multiples need share prices. Type a price into each peer&apos;s price box (from any quote site), or wait for the daily price file to load. Operating comparisons work without prices.</Note></div>}
      <ScrollTable>
        <thead><tr className="border-b border-rule text-xs uppercase tracking-wide text-muted text-right">
          <th className="p-2 text-left">Company</th><th className="p-2">Price</th><th className="p-2">Mkt value</th><th className="p-2">P/E</th><th className="p-2">P/B</th><th className="p-2">EV/Rev</th><th className="p-2">EV/Op inc</th><th className="p-2">Rev growth</th><th className="p-2">Net margin</th><th className="p-2">ROE</th><th className="p-2"></th>
        </tr></thead>
        <tbody>
          <tr className="border-b border-rule bg-accent-soft/40 font-medium">
            <td className="p-2 text-left">{s.c.ticker ?? s.c.name} <span className="text-xs text-muted">(target)</span></td>
            <td className="p-2 text-right">{perShare(s.price)}</td><td className="p-2 text-right">{money(tm.mcap)}</td>
            <td className="p-2 text-right">{times(tm.pe)}</td><td className="p-2 text-right">{times(tm.pb)}</td><td className="p-2 text-right">{times(tm.evRevenue)}</td><td className="p-2 text-right">{times(tm.evEbit)}</td>
            <td className="p-2 text-right">{signedPct(tm.revenueGrowth)}</td><td className="p-2 text-right">{pct(tm.netMargin)}</td><td className="p-2 text-right">{pct(tm.roe)}</td><td />
          </tr>
          {peerSides.map((p, i) => (
            <tr key={p.c.cik} className="border-b border-rule">
              <td className="p-2 text-left"><span className="font-medium">{p.c.ticker ?? "—"}</span> <span className="text-xs text-muted">{p.c.name}</span></td>
              <td className="p-1 text-right">
                <input type="number" step="0.01" aria-label={`Price for ${p.c.name}`} className="w-20 rounded border border-rule bg-paper px-1.5 py-1 text-right num"
                  value={p.price ?? ""} onChange={(e) => setPrices((x) => ({ ...x, [p.c.cik]: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="$" />
              </td>
              <td className="p-2 text-right">{money(pm[i].mcap)}</td>
              <td className="p-2 text-right">{times(pm[i].pe)}</td><td className="p-2 text-right">{times(pm[i].pb)}</td><td className="p-2 text-right">{times(pm[i].evRevenue)}</td><td className="p-2 text-right">{times(pm[i].evEbit)}</td>
              <td className="p-2 text-right">{signedPct(pm[i].revenueGrowth)}</td><td className="p-2 text-right">{pct(pm[i].netMargin)}</td><td className="p-2 text-right">{pct(pm[i].roe)}</td>
              <td className="p-2 text-right"><button type="button" className="text-xs text-muted underline" onClick={() => setPeers((x) => x.filter((c) => c !== p.c.cik))}>remove</button></td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="p-2 text-left">Peer median</td><td /><td />
            <td className="p-2 text-right">{times(med.pe)}</td><td className="p-2 text-right">{times(med.pb)}</td><td className="p-2 text-right">{times(med.evRevenue)}</td><td className="p-2 text-right">{times(med.evEbit)}</td>
            <td className="p-2 text-right">{signedPct(med.revenueGrowth)}</td><td className="p-2 text-right">{pct(med.netMargin)}</td><td className="p-2 text-right">{pct(med.roe)}</td><td />
          </tr>
        </tbody>
      </ScrollTable>
      <div className="mt-3 max-w-md"><Picker universe={universe.filter((c) => c.cik !== s.c.cik && !peerCiks.includes(c.cik))} onPick={(cik) => setPeers((x) => [...x, cik])} placeholder="Add a peer: name or ticker" /></div>

      <h3 className="mt-8 mb-2 font-serif text-lg font-semibold">What the peer medians imply for {s.c.ticker ?? s.c.name}</h3>
      <div className="grid gap-4 lg:grid-cols-2">
        <ScrollTable>
          <thead><tr className="border-b border-rule text-xs uppercase tracking-wide text-muted text-right"><th className="p-2 text-left">Method</th><th className="p-2">Peer median</th><th className="p-2">Implied per share</th><th className="p-2">vs price</th></tr></thead>
          <tbody>
            {implied.map((m) => (
              <tr key={m.label} className="border-b border-rule last:border-0">
                <td className="p-2 text-left">{m.label}</td><td className="p-2 text-right">{times(isNum(m.multiple) ? m.multiple : null)}</td>
                <td className="p-2 text-right">{perShare(m.value)}</td>
                <td className={`p-2 text-right ${m.value != null && s.price ? (m.value > s.price ? "text-pos" : "text-neg") : ""}`}>{m.value != null && s.price ? signedPct(m.value / s.price - 1) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </ScrollTable>
        <BarGroups title="Implied value per share by method" labels={implied.map((m) => m.label.split(" ")[0])}
          series={[{ name: "Implied", values: implied.map((m) => m.value) }, { name: "Current price", values: implied.map(() => s.price) }]} format={(v) => `$${v.toFixed(0)}`} height={170} />
      </div>

      <Explainer
        does={<>Comparable company analysis (&quot;comps&quot;) values a company by how the market prices similar companies. It computes ratios like price ÷ earnings and enterprise value ÷ revenue for a peer group, takes the median, and applies it to the target&apos;s own numbers.</>}
        purpose={<>It is the fastest way to see whether a stock looks cheap or expensive relative to its neighbors. Bankers use it to price IPOs and acquisitions, and analysts use it as a reality check on a DCF.</>}
        uses={<>Check whether a premium is earned: if a company trades at twice the peer P/E, does it also grow twice as fast or earn a much higher return on equity? Try different peer sets and see how much the answer moves.</>}
        limits={<>The peer pool is limited to North Carolina SEC filers on this site, so true competitors headquartered elsewhere aren&apos;t included. SEC industry codes are broad. Multiples use the latest annual report, not trailing-twelve-month or forecast earnings that professionals usually use.</>}
      />
    </div>
  );
}
