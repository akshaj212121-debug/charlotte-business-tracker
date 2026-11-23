"use client";
import { useState } from "react";
import { money, perShare, pct, signedPct } from "@/lib/format";
import { dcf, netDebt } from "@/lib/models";
import { BarGroups } from "./charts";
import { Explainer, Note, NumField, PctField, ScrollTable } from "./parts";
import { dcfDefaults } from "./Dcf";
import type { ModelProps, Side } from "./ModelLab";
import { useWhich } from "./which";

interface Sc { name: string; growth: number; wacc: number; tg: number; prob: number }

export default function Scenario({ a, b }: ModelProps) {
  const { s, control } = useWhich(a, b);
  return <Inner key={s.c.cik} s={s} control={control} />;
}

function Inner({ s, control }: { s: Side; control: React.ReactNode }) {
  const d = dcfDefaults(s);
  const [fcf0, setFcf0] = useState<number | null>(d.fcf0);
  const [sc, setSc] = useState<Sc[]>([
    { name: "Bear", growth: d.growth - 0.04, wacc: d.wacc + 0.01, tg: d.terminalGrowth - 0.005, prob: 0.25 },
    { name: "Base", growth: d.growth, wacc: d.wacc, tg: d.terminalGrowth, prob: 0.5 },
    { name: "Bull", growth: d.growth + 0.04, wacc: d.wacc - 0.01, tg: d.terminalGrowth + 0.005, prob: 0.25 },
  ]);
  const nd = netDebt(s.c);
  const value = (g: number, w: number, t: number) => {
    if (fcf0 == null) return null;
    const r = dcf({ fcf0, growth: g, years: 5, wacc: w, terminalGrowth: t, netDebt: nd, shares: s.shares });
    return r.valid ? r.perShare : null;
  };
  const vals = sc.map((x) => value(x.growth, x.wacc, x.tg));
  const probSum = sc.reduce((t, x) => t + x.prob, 0);
  const weighted = vals.every((v) => v != null) && probSum > 0 ? vals.reduce<number>((t, v, i) => t + v! * sc[i].prob, 0) / probSum : null;
  const upd = (i: number, k: keyof Sc) => (v: number) => setSc((x) => x.map((y, j) => (j === i ? { ...y, [k]: v } : y)));

  const base = sc[1];
  const waccs = [-0.02, -0.01, -0.005, 0, 0.005, 0.01, 0.02].map((dw) => base.wacc + dw);
  const tgs = [-0.01, -0.005, 0, 0.005, 0.01].map((dt) => base.tg + dt);
  const growths = [-0.06, -0.03, 0, 0.03, 0.06].map((dg) => base.growth + dg);
  const ref = s.price ?? vals[1];
  const cell = (v: number | null) => {
    if (v == null || ref == null) return {};
    const diff = Math.max(-1, Math.min(1, (v / ref - 1) * 2));
    return { background: diff >= 0 ? `color-mix(in srgb, var(--pos) ${Math.round(diff * 35)}%, transparent)` : `color-mix(in srgb, var(--neg) ${Math.round(-diff * 35)}%, transparent)` };
  };
  const grid = (rowsLabel: string, rows: number[], colsLabel: string, cols: number[], f: (r: number, c: number) => number | null) => (
    <ScrollTable>
      <thead><tr className="border-b border-rule text-xs text-muted">
        <th className="p-2 text-left font-medium">{rowsLabel} ↓ · {colsLabel} →</th>
        {cols.map((c) => <th key={c} className="p-2 text-right font-medium">{pct(c)}</th>)}
      </tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r} className="border-b border-rule last:border-0">
            <th className="p-2 text-left font-medium text-muted">{pct(r)}</th>
            {cols.map((c) => { const v = f(r, c); return <td key={c} className="p-2 text-right" style={cell(v)}>{perShare(v)}</td>; })}
          </tr>
        ))}
      </tbody>
    </ScrollTable>
  );

  return (
    <div>
      {control}
      {fcf0 == null || fcf0 <= 0 ? (
        <div className="mb-4"><Note tone="warn">This model runs on the DCF, which needs positive free cash flow. {s.c.name}&apos;s latest filing doesn&apos;t give one. Enter a starting free cash flow to explore.</Note></div>
      ) : null}
      <div className="max-w-xs mb-4"><NumField label="Starting free cash flow (all scenarios)" prefix="$" suffix="M" value={fcf0 != null ? fcf0 / 1e6 : null} onChange={(v) => setFcf0(v == null ? null : v * 1e6)} /></div>
      <h3 className="font-serif text-lg font-semibold mb-2">Scenarios</h3>
      <div className="grid gap-3 md:grid-cols-3">
        {sc.map((x, i) => (
          <div key={x.name} className="rounded-md border border-rule bg-card p-3">
            <p className="font-medium mb-2">{x.name} case</p>
            <div className="grid grid-cols-2 gap-2">
              <PctField label="FCF growth / yr" value={x.growth} onChange={upd(i, "growth")} />
              <PctField label="Discount rate" value={x.wacc} step={0.25} onChange={upd(i, "wacc")} />
              <PctField label="Terminal growth" value={x.tg} step={0.25} onChange={upd(i, "tg")} />
              <PctField label="Probability" value={x.prob} step={5} onChange={upd(i, "prob")} />
            </div>
            <p className="mt-3 text-sm">Value per share: <b className="num">{perShare(vals[i])}</b>{vals[i] != null && s.price ? <span className="text-muted"> ({signedPct(vals[i]! / s.price - 1)} vs price)</span> : null}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2 items-start">
        <div className="rounded-md border border-rule bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Probability-weighted value per share</p>
          <p className="mt-1 text-3xl font-semibold num">{perShare(weighted)}</p>
          <p className="mt-1 text-sm text-muted">{Math.abs(probSum - 1) > 0.001 ? `Probabilities add to ${pct(probSum, 0)}; they're rescaled to 100%. ` : ""}Share price used: {perShare(s.price)}. Net debt {money(nd)}.</p>
        </div>
        <BarGroups title="Value per share by scenario" labels={[...sc.map((x) => x.name), "Weighted"]} series={[{ name: "Value", values: [...vals, weighted] }, ...(s.price ? [{ name: "Price", values: [...sc.map(() => s.price), s.price] }] : [])]} format={(v) => `$${v.toFixed(0)}`} height={170} />
      </div>

      <h3 className="mt-8 font-serif text-lg font-semibold mb-1">Sensitivity: discount rate vs terminal growth</h3>
      <p className="text-sm text-muted mb-2">Value per share with base-case growth ({pct(base.growth)}). Green cells are above {s.price ? "the share price" : "the base value"}, red below.</p>
      {grid("Discount rate", waccs, "terminal growth", tgs, (w, t) => value(base.growth, w, t))}
      <h3 className="mt-6 font-serif text-lg font-semibold mb-1">Sensitivity: discount rate vs growth</h3>
      {grid("Discount rate", waccs, "FCF growth", growths, (w, g) => value(g, w, base.tg))}

      <Explainer
        does={<><b>Scenario analysis</b> builds a few complete stories (bear, base, bull), each with its own assumptions, and weights them by how likely you think they are. <b>Sensitivity analysis</b> changes one or two inputs at a time across a grid to show which assumptions the answer leans on most.</>}
        purpose={<>No one knows the future, so a single number is false precision. Professionals present a range and show how fragile the answer is. Risk managers use the same idea for &quot;stress tests.&quot;</>}
        uses={<>Find the assumptions that matter. If moving the discount rate by one point changes the value by 30%, that input deserves the most research. Ask how bad things must get before the value falls below the price, which is your margin of safety.</>}
        limits={<>Built on the simplified DCF from the DCF tab, so it carries the same limits. Probabilities are your judgment, not something the data can tell you.</>}
      />
    </div>
  );
}
