import type { Metadata } from "next";
import SortableTable, { type Column, type Row } from "@/components/SortableTable";
import { PageTitle } from "@/components/ui";
import { statewideNonprofits as nonprofits } from "@/lib/data";

export const metadata: Metadata = { title: "Nonprofits", description: "The largest North Carolina nonprofits by revenue, with Form 990 financials." };

const columns: Column[] = [
  { key: "name", label: "Organization", kind: "text" },
  { key: "city", label: "City", kind: "text" },
  { key: "sector", label: "Sector", kind: "text" },
  { key: "revenue", label: "Revenue", kind: "money" },
  { key: "revenueGrowth", label: "Rev. growth", kind: "signedPct", tone: true },
  { key: "surplus", label: "Surplus / deficit", kind: "money", tone: true },
  { key: "assets", label: "Total assets", kind: "money" },
  { key: "taxYear", label: "Tax year", kind: "text" },
];

export default function NonprofitsPage() {
  const rows: Row[] = nonprofits.map((n) => ({
    name: n.name,
    city: n.city,
    sector: n.sector,
    revenue: n.filings[0]?.revenue ?? n.irsBmf.revenue,
    revenueGrowth: n.derived?.revenueGrowth ?? null,
    surplus: n.derived?.surplus ?? null,
    assets: n.filings[0]?.assets ?? n.irsBmf.assets,
    taxYear: n.filings[0] ? String(n.filings[0].taxYear) : n.irsBmf.taxPeriod?.slice(0, 4) ?? null,
    href: `/nonprofits/${n.ein}`,
  }));
  return (
    <>
      <PageTitle kicker="Form 990 filers" title="North Carolina’s largest nonprofits">
        The 100 largest tax-exempt organizations based in North Carolina by reported revenue: hospital systems,
        universities, credit unions, foundations and charities. Figures come from the IRS Form 990 each one files every year.
        Large organizations file months after their fiscal year closes, so the newest year shown is usually one to two years old.
      </PageTitle>
      <SortableTable columns={columns} rows={rows} searchKeys={["name", "city", "sector"]} initialSort="revenue" placeholder="Search organization, city or sector" />
    </>
  );
}
