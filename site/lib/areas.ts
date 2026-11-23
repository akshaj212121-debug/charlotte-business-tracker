// County and town pages (/region, /region/[slug]). Every figure is a filter over data already in
// site/data/, plus one Census Bureau population estimate per area, typed in by hand from the files below.
import { companies, nonprofits, privateData, warnNotices, type Company, type Contractor, type Nonprofit } from "@/lib/data";

// U.S. Census Bureau, Vintage 2025 Population Estimates (population on July 1, 2025), checked 2026-11-22.
// Counties: co-est2025-alldata.csv (POPESTIMATE2025, ESTIMATESBASE2020).
// Towns: sub-est2025.csv, whole-place rows (SUMLEV 162). Update both each spring when the next vintage comes out.
export const CENSUS = {
  vintage: "Vintage 2025",
  asOf: "July 1, 2025",
  countyFile: "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/counties/totals/co-est2025-alldata.csv",
  cityFile: "https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/cities/totals/sub-est2025.csv",
};

export interface Area {
  slug: string;
  name: string; // display name
  kind: "county" | "town";
  county: string; // the county the area is in (for a county, itself)
  city?: string; // towns: matched against the city in each record's filed address
  census: { name: string; fips: string; pop2025: number; base2020: number };
  blurb: string;
}

export const AREAS: Area[] = [
  { slug: "mecklenburg", name: "Mecklenburg County", kind: "county", county: "Mecklenburg",
    census: { name: "Mecklenburg County", fips: "37119", pop2025: 1233383, base2020: 1115554 },
    blurb: "Charlotte’s home county and the core of the region." },
  { slug: "union", name: "Union County", kind: "county", county: "Union",
    census: { name: "Union County", fips: "37179", pop2025: 267674, base2020: 238179 },
    blurb: "Monroe, Indian Trail, Waxhaw and Weddington, southeast of Charlotte." },
  { slug: "cabarrus", name: "Cabarrus County", kind: "county", county: "Cabarrus",
    census: { name: "Cabarrus County", fips: "37025", pop2025: 249725, base2020: 225821 },
    blurb: "Concord and Kannapolis, northeast of Charlotte." },
  { slug: "gaston", name: "Gaston County", kind: "county", county: "Gaston",
    census: { name: "Gaston County", fips: "37071", pop2025: 246558, base2020: 227944 },
    blurb: "Gastonia, Belmont and Mount Holly, west of Charlotte." },
  { slug: "iredell", name: "Iredell County", kind: "county", county: "Iredell",
    census: { name: "Iredell County", fips: "37097", pop2025: 211798, base2020: 186686 },
    blurb: "Mooresville and Statesville, north of Lake Norman." },
  { slug: "concord", name: "Concord", kind: "town", county: "Cabarrus", city: "Concord",
    census: { name: "Concord city", fips: "3714100", pop2025: 114598, base2020: 105316 },
    blurb: "The largest city in Cabarrus County." },
  { slug: "gastonia", name: "Gastonia", kind: "town", county: "Gaston", city: "Gastonia",
    census: { name: "Gastonia city", fips: "3725580", pop2025: 87067, base2020: 80453 },
    blurb: "The seat and largest city of Gaston County." },
  { slug: "mooresville", name: "Mooresville", kind: "town", county: "Iredell", city: "Mooresville",
    census: { name: "Mooresville town", fips: "3744220", pop2025: 55842, base2020: 50288 },
    blurb: "Iredell County’s Lake Norman town." },
  { slug: "huntersville", name: "Huntersville", kind: "town", county: "Mecklenburg", city: "Huntersville",
    census: { name: "Huntersville town", fips: "3733120", pop2025: 68535, base2020: 61418 },
    blurb: "North Mecklenburg, between Charlotte and Lake Norman." },
  { slug: "matthews", name: "Matthews", kind: "town", county: "Mecklenburg", city: "Matthews",
    census: { name: "Matthews town", fips: "3741960", pop2025: 32769, base2020: 29427 },
    blurb: "Southeast Mecklenburg, on the Union County line." },
];

export const getArea = (slug: string) => AREAS.find((a) => a.slug === slug);
export const townsIn = (county: string) => AREAS.filter((a) => a.kind === "town" && a.county === county);

const sameCity = (a: string | null | undefined, b: string) => (a ?? "").trim().toUpperCase() === b.toUpperCase();

export function areaRecords(area: Area) {
  const inArea = (county: string | null, city: string | null | undefined) =>
    county === area.county && (area.kind === "county" || sameCity(city, area.city!));
  const cos: Company[] = companies.filter((c) => inArea(c.county, c.city));
  const nps: Nonprofit[] = nonprofits.filter((n) => inArea(n.county, n.city));
  const warn = warnNotices.filter((w) => inArea(w.county, w.city));
  // USAspending recipients are grouped by county only, so towns get no contractor table.
  const contractors: Contractor[] | null = area.kind === "county" ? privateData.localContractors[area.county] ?? null : null;
  return { cos, nps, warn, contractors };
}
