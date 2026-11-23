import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { PageTitle } from "@/components/ui";
import ModelLab from "@/components/models/ModelLab";
import { companies, companiesGeneratedAt } from "@/lib/data";
import { date } from "@/lib/format";
import type { ModelCompany } from "@/lib/models";

export const metadata: Metadata = {
  title: "Stock models",
  description: "Compare North Carolina public companies and try the models analysts use: three-statement, DCF, comparable companies, sum of the parts, scenarios, factor, risk and quant models. Educational, built from SEC filings.",
};

interface PricesFile { generatedAt: string; source: string; tickers: Record<string, { closes: [string, number][] }> }

// Daily closes are optional: written by pipeline/prices.mjs. The models work without them.
function loadPrices(): PricesFile | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "prices.json"), "utf8")) as PricesFile;
  } catch {
    return null;
  }
}

export default function ModelsPage() {
  const prices = loadPrices();
  const universe: ModelCompany[] = companies
    .filter((c) => c.years.length >= 2)
    .map((c) => {
      const ticker = c.tickers[0] ?? null;
      const closes = ticker ? prices?.tickers[ticker]?.closes ?? null : null;
      const last = closes?.[closes.length - 1];
      const sicN = Number(c.sic);
      return {
        cik: c.cik,
        name: c.name,
        ticker,
        industry: c.industry,
        sic: c.sic,
        city: c.city,
        financial: sicN >= 6000 && sicN < 6800,
        filingsUrl: c.sources.filings,
        distressSignals: c.filings.filter((f) => f.distress).length,
        closes,
        lastClose: last ? { value: last[1], date: last[0], source: prices!.source } : null,
        years: [...c.years].reverse().map((y) => ({
          end: y.end, revenue: y.revenue, operatingIncome: y.operatingIncome, netIncome: y.netIncome,
          ocf: y.operatingCashFlow, capex: y.capex, fcf: y.freeCashFlow, eps: y.epsDiluted, dps: y.dividendsPerShare,
          assets: y.assets, liabilities: y.liabilities, equity: y.equity, cash: y.cash, debt: y.longTermDebt,
        })),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const pick = (t: string) => universe.find((c) => c.ticker === t)?.cik ?? universe[0].cik;

  return (
    <>
      <PageTitle kicker="Learn how analysts value companies" title="Stock models and comparisons">
        Pick any of the {universe.length} North Carolina public companies on this site, compare two side by side, and run
        the same kinds of models used on Wall Street and at quant funds. Every starting figure comes from the
        companies&apos; SEC filings (data pulled {date(companiesGeneratedAt)}); every assumption is yours to change. Each model
        has a plain-English explanation underneath.
      </PageTitle>
      <div className="mb-8 rounded-md border border-neg/30 bg-warn-soft px-4 py-3 text-sm leading-relaxed">
        <b>Educational tool, not investment advice.</b> These models are simplified to teach how valuation works. Their
        output depends on assumptions you choose and is not a forecast, a price target or a recommendation to buy or sell
        anything. {prices ? `Share prices are daily closes as of ${prices.tickers && Object.values(prices.tickers)[0]?.closes.at(-1)?.[0]}.` : "Share prices aren't loaded yet: type one in to unlock price-based measures."}{" "}
        <Link href="/methodology" className="underline">How the data works</Link>.
      </div>
      <ModelLab universe={universe} defaultA={pick("LOW")} defaultB={pick("HON")} />
    </>
  );
}
