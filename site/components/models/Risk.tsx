"use client";
import { useState } from "react";
import { money, perShare, pct, times } from "@/lib/format";
import { annualVol, dailyReturns, growthRates, historicalVaR, isNum, latestYear, maxDrawdown, netDebt, stdev } from "@/lib/models";
import { SERIES } from "./charts";
import { Explainer, KV, Note, NumField, Panel, PctField, ScrollTable } from "./parts";
import type { ModelProps, Side } from "./ModelLab";

function riskStats(s: Side) {
  const c = s.c, y = latestYear(c);
  const closes = c.closes && c.closes.length > 40 ? c.closes : null;
  const r = closes ? dailyReturns(closes) : [];
  return {
    vol: closes ? annualVol(r) : null,
    mdd: closes ? maxDrawdown(closes) : null,
    var95: closes ? historicalVaR(r, 0.95) : null,
    days: closes?.length ?? 0,
    equityToAssets: y && isNum(y.equity) && isNum(y.assets) && y.assets ? y.equity / y.assets : null,
    debtToOpInc: y && isNum(y.operatingIncome) && y.operatingIncome > 0 ? netDebt(c) / y.operatingIncome : null,
    lossYears: c.years.filter((x) => isNum(x.netIncome) && x.netIncome < 0).length,
    negFcfYears: c.years.filter((x) => isNum(x.fcf) && x.fcf < 0).length,
    years: c.years.length,
    revVol: (() => { const v = stdev(growthRates(c.years.map((x) => x.revenue))); return isNum(v) ? v : null; })(),
    distress: c.distressSignals,
  };
}

export default function Risk({ a, b }: ModelProps) {
  const sides = [a, b].filter(Boolean) as Side[];
  const stats = sides.map(riskStats);
  const [account, setAccount] = useState(100000);
  const [riskPct, setRiskPct] = useState(0.01);
  const [entry, setEntry] = useState<number | null>(a.price);
  const [stop, setStop] = useState<number | null>(a.price ? Math.round(a.price * 0.92 * 100) / 100 : null);
  const [maxPos, setMaxPos] = useState(0.2);
  const [vol, setVol] = useState<number>(stats[0].vol ?? 0.3);
  const [targetVol, setTargetVol] = useState(0.02);
  const [p, setP] = useState(0.55);
  const [payoff, setPayoff] = useState(1.5);

  const perShareRisk = entry != null && stop != null ? entry - stop : null;
  const rawShares = perShareRisk && perShareRisk > 0 ? Math.floor((account * riskPct) / perShareRisk) : null;
  const capShares = entry ? Math.floor((account * maxPos) / entry) : null;
  const shares = rawShares != null && capShares != null ? Math.min(rawShares, capShares) : rawShares;
  const position = shares != null && entry ? shares * entry : null;
  const volWeight = vol > 0 ? targetVol / vol : null;
  const kelly = p - (1 - p) / payoff;

  return (
    <div>
      <Note>All money here is imaginary. Enter any account size to see how professional sizing rules work. Nothing on this page places or recommends a trade.</Note>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="1. Fixed-fraction sizing (risk per trade)">
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Account size (pretend)" prefix="$" value={account} step={1000} onChange={(v) => setAccount(v ?? 0)} />
            <PctField label="Risk per trade" value={riskPct} step={0.25} onChange={setRiskPct} hint="Max loss if the stop is hit" />
            <NumField label="Entry price" prefix="$" step={0.01} value={entry} onChange={setEntry} hint={`${a.c.ticker ?? a.c.name}: ${a.priceNote}`} />
            <NumField label="Stop-loss price" prefix="$" step={0.01} value={stop} onChange={setStop} />
            <PctField label="Max position size" value={maxPos} step={1} onChange={setMaxPos} hint="Cap as a share of the account" />
          </div>
          <div className="mt-3">
            <KV label="Risk per share" value={perShare(perShareRisk)} />
            <KV label="Shares" value={shares != null ? shares.toLocaleString() : "—"} strong />
            <KV label="Position value" value={money(position)} />
            <KV label="Share of account" value={position != null ? pct(position / account) : "—"} />
            <KV label="Loss if stop is hit" value={shares != null && perShareRisk ? money(shares * perShareRisk) : "—"} />
          </div>
          {rawShares != null && capShares != null && rawShares > capShares && <p className="mt-2 text-xs text-muted">The max-position cap is binding: the risk rule alone would allow {rawShares.toLocaleString()} shares.</p>}
          {perShareRisk != null && perShareRisk <= 0 && <p className="mt-2 text-xs text-neg">The stop must be below the entry price for a long position.</p>}
        </Panel>
        <Panel title="2. Volatility targeting">
          <div className="grid grid-cols-2 gap-3">
            <PctField label="Stock's annual volatility" value={vol} onChange={setVol} hint={stats[0].vol != null ? `Measured from ${stats[0].days} daily closes.` : "No price history on file; 30% is a rough typical figure for one stock."} />
            <PctField label="Target risk from this position" value={targetVol} step={0.25} onChange={setTargetVol} hint="Yearly swing of the whole account you'll accept from it" />
          </div>
          <div className="mt-3">
            <KV label="Position weight" value={pct(volWeight)} strong />
            <KV label="Position value" value={money(volWeight != null ? volWeight * account : null)} />
            <KV label="Typical 1-day move (1 standard deviation)" value={money(volWeight != null ? (volWeight * account * vol) / Math.sqrt(252) : null)} />
            <KV label="1-day 95% value at risk (normal approx.)" value={money(volWeight != null ? (1.645 * volWeight * account * vol) / Math.sqrt(252) : null)} />
          </div>
          <p className="mt-2 text-xs text-muted">Riskier stocks get smaller positions so each holding contributes a similar amount of risk.</p>
        </Panel>
        <Panel title="3. Kelly criterion">
          <div className="grid grid-cols-2 gap-3">
            <PctField label="Chance a trade wins" value={p} step={1} onChange={setP} />
            <NumField label="Avg win ÷ avg loss" suffix="×" step={0.1} value={payoff} onChange={(v) => setPayoff(v ?? 1)} />
          </div>
          <div className="mt-3">
            <KV label="Full Kelly fraction" value={pct(kelly)} strong tone={kelly < 0 ? "text-neg" : ""} />
            <KV label="Half Kelly (common in practice)" value={pct(kelly / 2)} />
          </div>
          <p className="mt-2 text-xs text-muted">{kelly <= 0 ? "Negative: with these odds the formula says don't bet at all." : "Full Kelly maximizes long-run growth only if your odds are exactly right. Real odds are uncertain, so practitioners bet a fraction of it."}</p>
        </Panel>
      </div>

      <h3 className="mt-8 font-serif text-lg font-semibold mb-2">Company risk check</h3>
      <ScrollTable>
        <thead><tr className="border-b border-rule text-xs uppercase tracking-wide text-muted text-right"><th className="p-2 text-left">Measure</th>{sides.map((s, i) => <th key={s.c.cik} className="p-2" style={{ color: SERIES[i] }}>{s.c.ticker ?? s.c.name}</th>)}</tr></thead>
        <tbody>
          {([
            ["Annual price volatility", (x) => pct(x.vol)],
            ["Worst peak-to-trough fall in price history", (x) => pct(x.mdd)],
            ["1-day historical 95% value at risk", (x) => pct(x.var95)],
            ["Equity ÷ assets (cushion against losses)", (x) => pct(x.equityToAssets)],
            ["Net debt ÷ operating income (years to repay)", (x) => times(x.debtToOpInc)],
            ["Years with a net loss", (x) => `${x.lossYears} of ${x.years}`],
            ["Years with negative free cash flow", (x) => `${x.negFcfYears} of ${x.years}`],
            ["Revenue growth swings (standard deviation)", (x) => pct(x.revVol)],
            ["Distress-type 8-K filings in recent list", (x) => String(x.distress)],
          ] as [string, (x: ReturnType<typeof riskStats>) => string][]).map(([l, f]) => (
            <tr key={l} className="border-b border-rule last:border-0"><td className="p-2 text-muted">{l}</td>{stats.map((x, i) => <td key={i} className="p-2 text-right">{f(x)}</td>)}</tr>
          ))}
        </tbody>
      </ScrollTable>
      {stats.every((x) => x.vol == null) && <p className="mt-2 text-xs text-muted">Price-based rows fill in once the daily price file is loaded. The filing-based rows work now.</p>}

      <Explainer
        does={<>Risk models measure how much you could lose, and position-sizing rules turn that into how much to buy. Fixed-fraction sizing caps the loss on any one trade. Volatility targeting gives jumpy stocks smaller weights. The Kelly formula sizes bets from your odds of winning.</>}
        purpose={<>Professional traders say they survive on risk management, not stock picks. A great idea sized too large can still wipe out an account. Funds use value at risk, drawdown limits and volatility targets every day.</>}
        uses={<>Practice the habit of deciding your exit and maximum loss before buying anything, including in the site&apos;s paper-trading simulator. Compare how risky two companies look on both price swings and balance-sheet strength.</>}
        limits={<>Value at risk assumes the future looks like the past, which fails in crises. Volatility from one year of prices is noisy. Kelly needs odds you can&apos;t truly know. These tools manage risk; they don&apos;t remove it.</>}
      />
    </div>
  );
}
