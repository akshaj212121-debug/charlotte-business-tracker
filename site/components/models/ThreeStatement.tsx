"use client";
import { useState } from "react";
import { money } from "@/lib/format";
import { defaultAssumptions, threeStatement, type Assumptions, type StatementYear } from "@/lib/models";
import { BarGroups, LineChart } from "./charts";
import { Explainer, Note, NumField, PctField, ScrollTable } from "./parts";
import type { ModelProps } from "./ModelLab";
import { useWhich } from "./which";

type RowDef = [string, keyof StatementYear, boolean?];
const IS: RowDef[] = [["Revenue", "revenue", true], ["Operating income", "operatingIncome"], ["Net income", "netIncome", true]];
const CF: RowDef[] = [["Operating cash flow", "ocf"], ["Capital spending", "capex"], ["Free cash flow", "fcf", true], ["Dividends paid", "dividends"], ["New borrowing (repayment)", "netBorrowing"]];
const BS: RowDef[] = [["Cash", "cash"], ["Other assets", "otherAssets"], ["Total assets", "assets", true], ["Long-term debt", "debt"], ["Other liabilities", "otherLiabilities"], ["Total liabilities", "liabilities", true], ["Shareholders' equity", "equity", true], ["Check: assets − liabilities − equity", "check"]];

export default function ThreeStatement({ a, b }: ModelProps) {
  const { s, control } = useWhich(a, b);
  return <Inner key={s.c.cik} {...{ s, control }} />;
}

function Inner({ s, control }: { s: ModelProps["a"]; control: React.ReactNode }) {
  const [asm, setAsm] = useState<Assumptions>(() => defaultAssumptions(s.c));
  const set = (k: keyof Assumptions) => (v: number) => setAsm((x) => ({ ...x, [k]: v }));
  const rows = threeStatement(s.c, asm);
  const firstProj = rows.findIndex((r) => r.projected);
  const section = (title: string, defs: RowDef[]) => (
    <>
      <tr><td colSpan={rows.length + 1} className="pt-4 pb-1 px-2 text-xs uppercase tracking-wide text-accent font-medium">{title}</td></tr>
      {defs.map(([label, key, strong]) => (
        <tr key={key} className={`border-b border-rule ${strong ? "font-semibold" : ""}`}>
          <td className="p-2 text-left whitespace-nowrap sticky left-0 bg-card">{label}</td>
          {rows.map((r) => { const v = r[key] as number | null; return (
            <td key={r.label} className={`p-2 text-right whitespace-nowrap ${r.projected ? "bg-accent-soft/40" : ""} ${key === "check" && v != null && Math.abs(v) > 1e6 ? "text-neg" : ""}`}>
              {key === "check" && v != null && Math.abs(v) < 1e3 ? "0 ✓" : money(v)}
            </td>
          ); })}
        </tr>
      ))}
    </>
  );
  return (
    <div>
      {control}
      {s.c.financial && <div className="mb-4"><Note tone="warn">{s.c.name} is a financial company. Its balance sheet is mostly loans, deposits or policy reserves, which this simplified model holds flat. Treat the projection as a rough sketch.</Note></div>}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        <PctField label="Revenue growth / yr" value={asm.growth} onChange={set("growth")} />
        <PctField label="Operating margin" value={asm.opMargin} onChange={set("opMargin")} />
        <PctField label="Net margin" value={asm.netMargin} onChange={set("netMargin")} />
        <PctField label="Cash conversion" value={asm.cashConversion} onChange={set("cashConversion")} step={5} hint="Operating cash flow ÷ net income" />
        <PctField label="Capex ÷ revenue" value={asm.capexPct} onChange={set("capexPct")} />
        <PctField label="Dividend payout" value={asm.payout} onChange={set("payout")} step={5} hint="Share of net income" />
        <NumField label="New borrowing / yr" prefix="$" suffix="M" value={asm.netBorrowing / 1e6} onChange={(v) => set("netBorrowing")((v ?? 0) * 1e6)} hint="Negative = repay debt" />
      </div>
      <p className="mt-2 text-xs text-muted">Starting values come from {s.c.name}&apos;s own history (median revenue growth, average margins and ratios), capped to sensible ranges. They are a starting point, not a forecast. <button type="button" className="underline" onClick={() => setAsm(defaultAssumptions(s.c))}>Reset</button></p>

      <div className="mt-5">
        <ScrollTable>
          <thead><tr className="border-b border-rule text-xs uppercase tracking-wide text-muted">
            <th className="p-2 text-left sticky left-0 bg-card">$</th>
            {rows.map((r) => <th key={r.label} className={`p-2 text-right font-medium ${r.projected ? "bg-accent-soft/40 text-accent" : ""}`}>{r.label}</th>)}
          </tr></thead>
          <tbody>
            {section("Income statement", IS)}
            {section("Cash flow statement", CF)}
            {section("Balance sheet", BS)}
          </tbody>
        </ScrollTable>
        <p className="mt-2 text-xs text-muted">Columns ending in E are projections from your assumptions (shaded). Other columns are as filed with the SEC. A dash means the company didn&apos;t tag that figure.</p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <LineChart title="Revenue and net income, filed then projected" labels={rows.map((r) => r.label)} shadeFrom={firstProj}
          series={[{ name: "Revenue", values: rows.map((r) => r.revenue) }, { name: "Net income", values: rows.map((r) => r.netIncome) }]} format={(v) => money(v, 0)} />
        <BarGroups title="Cash vs long-term debt" labels={rows.map((r) => r.label)}
          series={[{ name: "Cash", values: rows.map((r) => r.cash) }, { name: "Long-term debt", values: rows.map((r) => r.debt) }]} format={(v) => money(v, 0)} />
      </div>

      <Explainer
        does={<>Links the three financial statements. Revenue and margins set profit on the <b>income statement</b>. Profit, adjusted for cash conversion and capital spending, becomes cash on the <b>cash flow statement</b>. That cash, plus borrowing and minus dividends, lands on the <b>balance sheet</b>, where assets must always equal liabilities plus equity.</>}
        purpose={<>It is the foundation of almost every valuation. Bankers and analysts build one first because a DCF, a debt analysis or a dividend forecast all need projected statements that hang together.</>}
        uses={<>Ask &quot;what if&quot; questions: what if growth slows to 2%, what if margins shrink, what if the company borrows $500M? Watch how cash, debt and equity respond. The check row proves the model balances.</>}
        limits={<>A professional model forecasts dozens of lines (receivables, inventory, depreciation, taxes, interest). SEC data here has about 14 lines per year, so working capital, depreciation and taxes are folded into &quot;cash conversion&quot; and &quot;other assets.&quot; Non-debt liabilities are held flat.</>}
      />
    </div>
  );
}
