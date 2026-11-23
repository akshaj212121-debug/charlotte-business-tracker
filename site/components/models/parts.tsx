"use client";
// Shared inputs and layout pieces for the models section.
import { useEffect, useState } from "react";

export function NumField({ label, value, onChange, step = 1, suffix, prefix, hint, min, max }: {
  label: string; value: number | null; onChange: (v: number | null) => void; step?: number; suffix?: string; prefix?: string; hint?: string; min?: number; max?: number;
}) {
  // Keep the raw text while typing so "-" or "0." don't get swallowed.
  const [text, setText] = useState(value == null ? "" : String(round(value)));
  useEffect(() => { setText((t) => (Number(t) === value || (t === "" && value == null) ? t : value == null ? "" : String(round(value)))); }, [value]);
  return (
    <label className="block text-sm min-w-0">
      <span className="block text-xs text-muted mb-1">{label}</span>
      <span className="flex items-center rounded border border-rule bg-card focus-within:border-accent">
        {prefix && <span className="pl-2 text-muted text-sm">{prefix}</span>}
        <input
          type="number" inputMode="decimal" step={step} min={min} max={max}
          className="w-full min-w-0 bg-transparent px-2 py-1.5 num outline-none"
          value={text}
          onChange={(e) => { setText(e.target.value); const n = e.target.value === "" ? null : Number(e.target.value); onChange(n != null && Number.isFinite(n) ? n : null); }}
        />
        {suffix && <span className="pr-2 text-muted text-sm whitespace-nowrap">{suffix}</span>}
      </span>
      {hint && <span className="block text-[11px] text-muted mt-1 leading-snug">{hint}</span>}
    </label>
  );
}

/** Percent field: shows 7.5 for 0.075. */
export function PctField({ label, value, onChange, step = 0.5, hint }: { label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string }) {
  return <NumField label={label} value={value * 100} step={step} suffix="%" hint={hint} onChange={(v) => onChange((v ?? 0) / 100)} />;
}

function round(n: number) { return Math.round(n * 100) / 100; }

export function Explainer({ does, purpose, uses, limits }: { does: React.ReactNode; purpose: React.ReactNode; uses: React.ReactNode; limits: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-md border border-rule bg-accent-soft/40 p-4 sm:p-5 text-sm leading-relaxed">
      <h3 className="font-serif text-lg font-semibold mb-3">About this model</h3>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-xs uppercase tracking-wide text-accent font-medium">What it does</dt><dd className="mt-1">{does}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-accent font-medium">Why analysts use it</dt><dd className="mt-1">{purpose}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-accent font-medium">What you can use it for</dt><dd className="mt-1">{uses}</dd></div>
        <div><dt className="text-xs uppercase tracking-wide text-accent font-medium">Limits of this version</dt><dd className="mt-1">{limits}</dd></div>
      </dl>
    </section>
  );
}

export function Note({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "warn" }) {
  return <p className={`rounded border px-3 py-2 text-sm leading-relaxed ${tone === "warn" ? "border-neg/30 bg-warn-soft" : "border-rule bg-card text-muted"}`}>{children}</p>;
}

export function Panel({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-rule bg-card p-4 min-w-0 ${className}`}>
      {title && <h3 className="text-xs uppercase tracking-wide text-muted mb-3">{title}</h3>}
      {children}
    </div>
  );
}

export function KV({ label, value, strong, tone = "" }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1 border-b border-rule last:border-0 ${strong ? "font-semibold" : ""}`}>
      <span className="text-muted text-sm">{label}</span>
      <span className={`num text-sm ${tone}`}>{value}</span>
    </div>
  );
}

export function ScrollTable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-md border border-rule bg-card"><table className="w-full text-sm num">{children}</table></div>;
}
