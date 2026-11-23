"use client";
import { useState } from "react";
import { money, perShare, signedPct } from "@/lib/format";
import { isNum, latestYear, netDebt } from "@/lib/models";
import { BarGroups } from "./charts";
import { Explainer, KV, Note, NumField, Panel, PctField } from "./parts";
import type { ModelProps, Side } from "./ModelLab";
import { useWhich } from "./which";

interface Seg { id: number; name: string; metric: number | null; multiple: number | null }

export default function Sotp({ a, b }: ModelProps) {
  const { s, control } = useWhich(a, b);
  return <Inner key={s.c.cik} s={s} control={control} />;
}

function Inner({ s, control }: { s: Side; control: React.ReactNode }) {
  const y = latestYear(s.c);
  const start = isNum(y?.operatingIncome) ? y.operatingIncome : y?.netIncome ?? null;
  const [segs, setSegs] = useState<Seg[]>([{ id: 1, name: "Whole company", metric: start != null ? start / 1e6 : null, multiple: 12 }]);
  const [discount, setDiscount] = useState(0);
  const [nd, setNd] = useState<number>(netDebt(s.c) / 1e6);
  const upd = (id: number, patch: Partial<Seg>) => setSegs((x) => x.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const values = segs.map((g) => (g.metric != null && g.multiple != null ? g.metric * 1e6 * g.multiple : null));
  const gross = values.reduce<number>((t, v) => t + (v ?? 0), 0);
  const ev = gross * (1 - discount);
  const equity = ev - nd * 1e6;
  const ps = s.shares ? equity / s.shares : null;
  return (
    <div>
      {control}
      <Note>
        SEC structured data gives one total per company, not a breakdown by business line. To split {s.c.name} into parts, open the segment note in its latest{" "}
        <a className="underline text-accent" href={s.c.filingsUrl} target="_blank" rel="noopener noreferrer">10-K annual report</a>{" "}
        (search for &quot;segment&quot;), and enter each segment&apos;s operating income with a multiple that fits that kind of business. It starts as one segment: the whole company&apos;s {isNum(y?.operatingIncome) ? "operating income" : "net income"} for FY{y?.end.slice(0, 4)}.
      </Note>
      <div className="mt-4 space-y-3">
        {segs.map((g, i) => (
          <div key={g.id} className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 items-end rounded-md border border-rule bg-card p-3">
            <label className="block text-sm col-span-2 sm:col-span-1"><span className="block text-xs text-muted mb-1">Segment {i + 1}</span>
              <input className="w-full rounded border border-rule bg-paper px-2 py-1.5" value={g.name} onChange={(e) => upd(g.id, { name: e.target.value })} />
            </label>
            <NumField label="Operating income" prefix="$" suffix="M" value={g.metric} onChange={(v) => upd(g.id, { metric: v })} />
            <NumField label="EV ÷ operating income" suffix="×" step={0.5} value={g.multiple} onChange={(v) => upd(g.id, { multiple: v })} />
            <div className="text-sm"><span className="block text-xs text-muted mb-1">Segment value</span><span className="num font-medium">{money(values[i])}</span></div>
            <button type="button" disabled={segs.length === 1} onClick={() => setSegs((x) => x.filter((z) => z.id !== g.id))} className="text-xs text-muted underline disabled:opacity-40 justify-self-start">remove</button>
          </div>
        ))}
        <button type="button" onClick={() => setSegs((x) => [...x, { id: Date.now(), name: `Segment ${x.length + 1}`, metric: null, multiple: 10 }])}
          className="rounded border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent-soft">+ Add segment</button>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Adding up the parts">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <PctField label="Conglomerate discount" value={discount} step={1} onChange={setDiscount} hint="Markets often value a mix of businesses below the sum. 0–20% is typical." />
            <NumField label="Net debt" prefix="$" suffix="M" value={nd} onChange={(v) => setNd(v ?? 0)} hint="Long-term debt minus cash, from the filing. Edit if needed." />
          </div>
          <KV label="Sum of segment values" value={money(gross)} />
          <KV label="After conglomerate discount" value={money(ev)} strong />
          <KV label="Minus net debt" value={money(-nd * 1e6)} />
          <KV label="Equity value" value={money(equity)} strong />
          <KV label="Per share" value={perShare(ps)} strong />
          <KV label="vs share price" value={ps != null && s.price ? signedPct(ps / s.price - 1) : "—"} tone={ps != null && s.price ? (ps > s.price ? "text-pos" : "text-neg") : ""} />
        </Panel>
        <BarGroups title="Value by segment" labels={[...segs.map((g) => g.name.slice(0, 14)), "Total EV"]} series={[{ name: "Value", values: [...values, ev] }]} format={(v) => money(v, 0)} />
      </div>
      <Explainer
        does={<>A sum-of-the-parts (SOTP) model values each business line separately, using a multiple that suits that line, then adds them up and subtracts debt. A company with a slow utility arm and a fast-growing tech arm gets a different multiple for each.</>}
        purpose={<>A single multiple can badly misprice a company that does several different things. Analysts use SOTP for conglomerates, and activist investors use it to argue that a company is worth more broken up.</>}
        uses={<>Ask whether the market is giving credit for a hidden gem inside a bigger company, or what a spin-off might be worth. Compare the per-share result with the price to see the implied &quot;conglomerate discount.&quot;</>}
        limits={<>Segment figures aren&apos;t in SEC structured data, so you enter them from the 10-K. Multiples are your judgment; the Comparable companies tab can help you pick them. Corporate overhead not assigned to any segment should be entered as its own negative segment.</>}
      />
    </div>
  );
}
