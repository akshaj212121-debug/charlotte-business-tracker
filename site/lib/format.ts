// Display formatting shared by server and client components. null/undefined always renders as an em dash.
export type Nullable<T> = T | null | undefined;

export function money(n: Nullable<number>, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n < 0 ? "−" : "";
  const a = Math.abs(n);
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(digits)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

export function perShare(n: Nullable<number>): string {
  if (n == null) return "—";
  return `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;
}

export function pct(n: Nullable<number>, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n < 0 ? "−" : ""}${Math.abs(n * 100).toFixed(digits)}%`;
}

export function signedPct(n: Nullable<number>): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n * 100).toFixed(1)}%`;
}

export function times(n: Nullable<number>): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}×`;
}

export function int(n: Nullable<number>): string {
  return n == null ? "—" : n.toLocaleString("en-US");
}

export function date(iso: Nullable<string>): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function fiscalYear(endIso: string): string {
  return `FY ${endIso.slice(0, 4)}`;
}

export type FormatKind = "money" | "pct" | "signedPct" | "int" | "text" | "date" | "perShare";

export function formatValue(kind: FormatKind, v: unknown): string {
  if (v == null || v === "") return "—";
  switch (kind) {
    case "money": return money(v as number);
    case "pct": return pct(v as number);
    case "signedPct": return signedPct(v as number);
    case "int": return int(v as number);
    case "date": return date(v as string);
    case "perShare": return perShare(v as number);
    default: return String(v);
  }
}

export function tone(n: Nullable<number>): string {
  if (n == null || n === 0) return "";
  return n > 0 ? "text-pos" : "text-neg";
}
