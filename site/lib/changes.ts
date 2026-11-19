// Month-over-month changes written by pipeline/snapshot.mjs into data/changes/<YYYY-MM>.json.
import fs from "node:fs";
import path from "node:path";

interface Base { id: string }
export interface CompanyChange extends Base { name: string; county: string | null; fyEnd: string | null; revenue: number | null; netIncome: number | null; qEnd: string | null; qLabel: string | null; qRevenue: number | null; qRevenueGrowth: number | null; qNetIncome: number | null; prevFyEnd?: string | null }
export interface SignalChange extends Base { cik: number; name: string; date: string; form: string; items: string[] }
export interface WarnChange extends Base { company: string; county: string; city: string | null; affected: number; noticeDate: string; effectiveDate: string; type: string }
export interface ContractorChange extends Base { name: string; amount: number }
export interface NonprofitChange extends Base { name: string; county: string | null; taxYear: number; revenue: number | null; prevTaxYear: number | null }
export interface AwardChange extends Base { recipient: string; amount: number; agency: string; startDate: string; source: string }

export interface Changes {
  month: string;
  previousMonth: string | null;
  baseline: boolean;
  companiesAdded?: CompanyChange[];
  companiesRemoved?: CompanyChange[];
  newAnnualReports?: CompanyChange[];
  newQuarterlyReports?: CompanyChange[];
  newSignals?: SignalChange[];
  newWarn?: WarnChange[];
  newWarnWorkers?: number;
  contractorFYChanged?: boolean;
  contractorsEntered?: ContractorChange[];
  contractorsExited?: ContractorChange[];
  nonprofitNew990s?: NonprofitChange[];
  newAwards?: AwardChange[];
}

const DIR = path.join(process.cwd(), "data", "changes");

export function getChanges(month: string): Changes | null {
  const file = path.join(DIR, `${month}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Changes) : null;
}

export function latestChanges(): Changes | null {
  if (!fs.existsSync(DIR)) return null;
  const last = fs.readdirSync(DIR).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort().at(-1);
  return last ? getChanges(last.replace(/\.json$/, "")) : null;
}
