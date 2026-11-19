// Typed access to the JSON the pipeline writes into site/data/. Everything here is public-record data.
import companiesFile from "@/data/public-companies.json";
import nonprofitsFile from "@/data/nonprofits.json";
import privateFile from "@/data/private.json";

export interface FiscalYearRow {
  end: string;
  revenueCalc: boolean; // true = bank revenue computed as net interest income + noninterest income
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  freeCashFlow: number | null;
  epsDiluted: number | null;
  dividendsPerShare: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  cash: number | null;
  longTermDebt: number | null;
}

export interface LatestQuarter {
  end: string;
  start: string;
  filed: string;
  form: string;
  label: string; // e.g. "Q3 FY2026" (the company's own fiscal calendar)
  url: string;
  revenue: number | null;
  revenueCalc: boolean;
  netIncome: number | null;
  epsDiluted: number | null;
  prior: { end: string; revenue: number | null; netIncome: number | null; epsDiluted: number | null } | null;
  revenueGrowth: number | null;
  netIncomeGrowth: number | null;
}

export interface Filing {
  form: string;
  date: string;
  items: { code: string; label: string }[];
  url: string;
  distress: boolean;
}

export interface Company {
  cik: number;
  name: string;
  legalName: string;
  tickers: string[];
  exchanges: (string | null)[];
  sic: string;
  industry: string;
  city: string;
  state: string;
  zip: string | null;
  county: string | null;
  countyFrom: "zip" | "city" | null;
  latestQuarter: LatestQuarter | null;
  pendingReport: { form: string; reportDate: string; filed: string; url: string } | null;
  fiscalYearEnd: string | null;
  filerCategory: string;
  website: string | null;
  formerNames: string[];
  years: FiscalYearRow[];
  derived: {
    revenueGrowth: number | null;
    netIncomeGrowth: number | null;
    netMargin: number | null;
    operatingMargin: number | null;
    returnOnEquity: number | null;
    returnOnAssets: number | null;
    liabilitiesToEquity: number | null;
    fcfMargin: number | null;
  } | null;
  filings: Filing[];
  signals: Filing[];
  sources: { filings: string; xbrl: string };
}

export interface NonprofitFiling {
  taxYear: number;
  periodEnd: string;
  form: string;
  revenue: number;
  expenses: number | null;
  contributions: number | null;
  programRevenue: number | null;
  investmentIncome: number | null;
  assets: number | null;
  liabilities: number | null;
  netAssets: number | null;
  officerCompensation: number | null;
  pdf: string | null;
}

export interface Nonprofit {
  ein: string;
  name: string;
  city: string;
  zip: string | null;
  county: string | null;
  rankStatewide: number | null; // rank among the 100 largest NC nonprofits (IRS master-file revenue)
  rankRegion: number | null; // rank among the 25 largest in the Charlotte region
  sector: string;
  nteeCode: string | null;
  taxStatus: string;
  rulingYear: string | null;
  irsBmf: { revenue: number | null; income: number | null; assets: number | null; taxPeriod: string };
  filings: NonprofitFiling[];
  derived: {
    surplus: number | null;
    surplusMargin: number | null;
    revenueGrowth: number | null;
    liabilitiesToAssets: number | null;
    contributionShare: number | null;
  } | null;
  sources: { propublica: string; irsBmf: string };
}

export interface Contractor {
  name: string;
  recipientId: string;
  uei: string | null;
  growth: number | null;
  source: string;
  [fy: string]: string | number | null;
}

export interface Award {
  recipient: string;
  amount: number;
  agency: string;
  startDate: string;
  description: string;
  awardId: string;
  source: string;
}

export interface WarnNotice {
  company: string;
  county: string;
  city: string | null;
  noticeNumber: string;
  noticeDate: string;
  effectiveDate: string;
  type: string;
  permanence: string;
  affected: number;
}

const usDate = (s: string) => {
  const [m, d, y] = s.split("/").map(Number);
  return y ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : s;
};

export const companies = (companiesFile.companies as unknown as Company[])
  .filter((c) => c.years.length > 0 || c.filings.length > 0);
export const companiesGeneratedAt = companiesFile.generatedAt as string;

export const nonprofits = (nonprofitsFile.organizations as unknown as Nonprofit[])
  .slice()
  .sort((a, b) => (b.filings[0]?.revenue ?? b.irsBmf.revenue ?? 0) - (a.filings[0]?.revenue ?? a.irsBmf.revenue ?? 0));

export const statewideNonprofits = nonprofits.filter((n) => n.rankStatewide != null);

// Charlotte-Concord-Gastonia MSA, NC counties (OMB Bulletin 23-01). Mirrors pipeline/geo.mjs.
export const CORE_COUNTIES = ["Mecklenburg", "Union"];
export const REGION_COUNTIES = ["Mecklenburg", "Union", "Cabarrus", "Gaston", "Iredell", "Lincoln", "Rowan", "Anson"];
export const inRegion = (county: string | null | undefined) => !!county && REGION_COUNTIES.includes(county);

export const privateData = privateFile as unknown as {
  generatedAt: string;
  fiscalYears: { completed: string; prior: string; current: string };
  contractors: Contractor[];
  localContractors: Record<string, Contractor[]>;
  newAwards: Award[];
  warn: { year: number; sourceCsv: string; sourcePage: string; totals: { notices: number; workersAffected: number }; notices: WarnNotice[] };
};

export const warnNotices = privateData.warn.notices
  .map((w) => ({ ...w, noticeDate: usDate(w.noticeDate), effectiveDate: usDate(w.effectiveDate) }))
  .sort((a, b) => b.noticeDate.localeCompare(a.noticeDate));

export function getCompany(cik: string) {
  return companies.find((c) => String(c.cik) === cik);
}

export function getNonprofit(ein: string) {
  return nonprofits.find((n) => n.ein === ein);
}

export const latest = (c: Company) => c.years[0];
