import type { Metadata } from "next";
import SortableTable, { type Column, type Row } from "@/components/SortableTable";
import { PageTitle } from "@/components/ui";
import { companies, companiesGeneratedAt } from "@/lib/data";
import { date } from "@/lib/format";

export const metadata: Metadata = { title: "Public companies", description: "Every SEC-registered company headquartered in North Carolina, with five years of filed financials." };

const columns: Column[] = [
  { key: "name", label: "Company", kind: "text" },
  { key: "ticker", label: "Ticker", kind: "text" },
  { key: "city", label: "City", kind: "text" },
  { key: "revenue", label: "Revenue", kind: "money" },
  { key: "revenueGrowth", label: "Rev. growth", kind: "signedPct", tone: true },
  { key: "netIncome", label: "Net income", kind: "money", tone: true },
  { key: "netMargin", label: "Net margin", kind: "pct", tone: true },
  { key: "assets", label: "Total assets", kind: "money" },
  { key: "fy", label: "Fiscal year", kind: "text" },
];

export default function CompaniesPage() {
  const rows: Row[] = companies.map((c) => ({
    name: c.name,
    ticker: c.tickers[0] ?? null,
    allTickers: c.tickers.join(" "), // searchable, not displayed (preferreds, other share classes)
    city: c.city,
    industry: c.industry,
    revenue: c.years[0]?.revenue ?? null,
    revenueGrowth: c.derived?.revenueGrowth ?? null,
    netIncome: c.years[0]?.netIncome ?? null,
    netMargin: c.derived?.netMargin ?? null,
    assets: c.years[0]?.assets ?? null,
    fy: c.years[0]?.end.slice(0, 4) ?? null,
    href: `/companies/${c.cik}`,
  }));
  return (
    <>
      <PageTitle kicker="SEC filers" title="North Carolina public companies">
        Every company registered with the SEC whose headquarters address is in North Carolina, with financials taken
        straight from the structured data in their annual reports. Data pulled {date(companiesGeneratedAt)}.
      </PageTitle>
      <SortableTable columns={columns} rows={rows} searchKeys={["name", "allTickers", "city", "industry"]} initialSort="revenue" placeholder="Search company, ticker, city or industry" />
    </>
  );
}
