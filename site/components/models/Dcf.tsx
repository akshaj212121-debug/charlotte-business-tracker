"use client";
import { useState } from "react";
import { money, perShare, pct, signedPct } from "@/lib/format";
import { baseFcf, clamp, dcf, defaultAssumptions, netDebt } from "@/lib/models";
import { BarGroups } from "./charts";
import { Explainer, KV, Note, NumField, Panel, PctField } from "./parts";
import type { ModelProps, Side } from "./ModelLab";
import { useWhich } from "./which";

export interface DcfState { fcf0: number | null; growth: number; years: number; wacc: number; terminalGrowth: number }

export function dcfDefaults(s: Side): DcfState {
  return { fcf0: baseFcf(s.c).value, growth: clamp(defaultAssumptions(s.c).growth, -0.02, 0.1), years: 5, wacc: 0.09, terminalGrowth: 0.025 };
}

export default function Dcf({ a, b }: ModelProps) {
  const { s, control } = useWhich(a, b);
  return <Inner key={s.c.cik} s={s} control={control} />;
}

function Inner({ s, control }: { s: Side; control: React.ReactNode }) {
  const [st, setSt] = useState<DcfState>(() => dcfDefaults(s));
  const base = baseFcf(s.c);
  const nd = netDebt(s.c);
  const r = st.fcf0 != null ? dcf({ fcf0: st.fcf0, growth: st.growth, years: st.years, wacc: st.wacc, terminalGrowth: st.terminalGrowth, netDebt: nd, shares: s.shares }) : null;
  const upside = r?.perShare != null && s.price ? r.perShare / s.price - 1 : null;
  return (
    <div>
      {control}
      {s.c.financial && <div className="mb-4"><Note tone="warn">{s.c.name} is a bank, insurer or other financial company. Analysts usually value these with a dividend discount model or price-to-book, because debt and deposits are their raw material, not financing. A free-cash-flow DCF will give odd answers here.</Note></div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="Assumptions">
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Starting free cash flow" prefix="$" suffix="M" value={st.fcf0 != null ? st.fcf0 / 1e6 : null} onChange={(v) => setSt((x) => ({ ...x, fcf0: v == null ? null : v * 1e6 }))} />
            <PctField label="FCF growth, forecast years" value={st.growth} onChange={(v) => setSt((x) => ({ ...x, growth: v }))} />
            <NumField label="Forecast years" value={st.years} min={1} max={15} onChange={(v) => setSt((x) => ({ ...x, years: clamp(Math.round(v ?? 5), 1, 15) }))} />
            <PctField label="Discount rate (WACC)" value={st.wacc} step={0.25} onChange={(v) => setSt((x) => ({ ...x, wacc: v }))} hint="The return investors demand. 7–11% is a common range for large US companies." />
            <PctField label="Terminal growth" value={st.terminalGrowth} step={0.25} onChange={(v) => setSt((x) => ({ ...x, terminalGrowth: v }))} hint="Growth forever after the forecast. Usually 2–3%, near long-run inflation." />
          </div>
          <p className="mt-3 text-xs text-muted">{base.note} Net debt {money(nd)} (long-term debt minus cash; debt counts as zero if the filing doesn&apos;t tag it). <button type="button" className="underline" onClick={() => setSt(dcfDefaults(s))}>Reset</button></p>
        </Panel>
        <Panel title="Result">
          {!r ? <Note>No cash-flow data on file for this company, so a DCF can&apos;t be built from filings. Enter a starting free cash flow to try one.</Note> : (
            <>
              {!r.valid && <div className="mb-3"><Note tone="warn">{r.reason}</Note></div>}
              <KV label={`Present value of ${st.years} years of cash flow`} value={money(r.pvFcf)} />
              <KV label="Terminal value (all years after), today's dollars" value={money(r.pvTerminal)} />
              <KV label="Enterprise value" value={money(r.enterpriseValue)} strong />
              <KV label="Minus net debt" value={money(-nd)} />
              <KV label="Equity value" value={money(r.equityValue)} strong />
              <KV label="Diluted shares" value={s.shares ? `${(s.shares / 1e6).toFixed(1)}M` : "—"} />
              <KV label="Implied value per share" value={r.valid ? perShare(r.perShare) : "—"} strong />
              <KV label="Share price used" value={perShare(s.price)} />
              <KV label="Gap vs price" value={r.valid ? signedPct(upside) : "—"} tone={upside == null || !r.valid ? "" : upside > 0 ? "text-pos" : "text-neg"} />
              {r.valid && <p className="mt-3 text-xs text-muted">The terminal value is {pct(r.terminalShare, 0)} of the total. When that share is high, the answer depends mostly on the guess about the far future.</p>}
            </>
          )}
        </Panel>
      </div>
      {r && r.valid && (
        <div className="mt-4 max-w-3xl">
          <BarGroups title="Projected free cash flow vs its value today" labels={r.rows.map((x) => `Yr ${x.year}`)}
            series={[{ name: "Projected FCF", values: r.rows.map((x) => x.fcf) }, { name: "Present value", values: r.rows.map((x) => x.pv) }]} format={(v) => money(v, 0)} />
        </div>
      )}
      <Explainer
        does={<>A discounted cash flow model estimates what a business is worth today from the cash it will produce in the future. Each future year&apos;s cash is shrunk (&quot;discounted&quot;) because a dollar later is worth less than a dollar now. A terminal value covers every year after the forecast.</>}
        purpose={<>It values a company on its own fundamentals instead of on what other stocks trade for. It is the standard &quot;intrinsic value&quot; tool in equity research, investment banking and corporate finance.</>}
        uses={<>Turn the question around: what growth rate does today&apos;s share price assume? Raise or lower growth and the discount rate until the implied value matches the price. If the market is pricing in 12% growth and the company has never grown more than 4%, that tells you something.</>}
        limits={<>Small changes in the discount rate or terminal growth swing the answer a lot (see the sensitivity table in the Scenarios tab). Real models forecast revenue, margins, taxes, capex and working capital separately. This one grows a single free cash flow figure. Share count is estimated from EPS.</>}
      />
    </div>
  );
}
