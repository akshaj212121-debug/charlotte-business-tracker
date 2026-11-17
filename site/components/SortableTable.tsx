"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatValue, type FormatKind } from "@/lib/format";

export interface Column {
  key: string;
  label: string;
  kind: FormatKind;
  tone?: boolean; // color positive/negative numbers
}

export type Row = Record<string, string | number | null> & { href?: string | null };

interface Props {
  columns: Column[];
  rows: Row[];
  searchKeys: string[];
  initialSort: string;
  placeholder?: string;
  pageSize?: number;
}

export default function SortableTable({ columns, rows, searchKeys, initialSort, placeholder = "Search", pageSize = 100 }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: initialSort, dir: -1 });
  const [limit, setLimit] = useState(pageSize);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)))
      : rows;
    return [...filtered].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // blanks always last
      if (bv == null) return -1;
      return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
    });
  }, [rows, query, sort, searchKeys]);

  const toggle = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: columns.find((c) => c.key === key)?.kind === "text" ? 1 : -1 }));

  return (
    <div>
      <label className="block mb-3">
        <span className="sr-only">{placeholder}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setLimit(pageSize); }}
          placeholder={placeholder}
          className="w-full sm:w-80 rounded-md border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
      <p className="text-xs text-muted mb-2">{visible.length.toLocaleString()} of {rows.length.toLocaleString()} shown</p>
      <div className="overflow-x-auto rounded-md border border-rule bg-card">
        <table className="w-full text-sm num">
          <thead>
            <tr className="border-b border-rule">
              {columns.map((c, i) => (
                <th key={c.key} scope="col" className={`px-3 py-2 font-medium text-xs uppercase tracking-wide text-muted whitespace-nowrap ${i === 0 ? "text-left" : c.kind === "text" ? "text-left" : "text-right"}`}>
                  <button type="button" onClick={() => toggle(c.key)} className="hover:text-ink" aria-label={`Sort by ${c.label}`}>
                    {c.label}{sort.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, limit).map((r, idx) => (
              <tr key={`${r.href ?? ""}-${idx}`} className="border-b border-rule last:border-0 hover:bg-accent-soft/40">
                {columns.map((c, i) => {
                  const text = formatValue(c.kind, r[c.key]);
                  const v = r[c.key];
                  const toneCls = c.tone && typeof v === "number" ? (v > 0 ? "text-pos" : v < 0 ? "text-neg" : "") : "";
                  return (
                    <td key={c.key} className={`px-3 py-2 ${i === 0 || c.kind === "text" ? "text-left" : "text-right"} ${i === 0 ? "font-medium" : ""} ${toneCls} ${c.kind === "text" && i > 0 ? "text-muted" : ""}`}>
                      {i === 0 && r.href ? <Link href={r.href} className="hover:text-accent hover:underline">{text}</Link> : text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + pageSize)} className="mt-3 text-sm text-accent hover:underline">
          Show {Math.min(pageSize, visible.length - limit)} more
        </button>
      )}
    </div>
  );
}
