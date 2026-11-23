// Small presentational pieces shared by the server-rendered pages.
import Link from "next/link";

export function PageTitle({ kicker, title, children }: { kicker?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      {kicker && <p className="text-xs uppercase tracking-[0.16em] text-accent font-medium mb-1">{kicker}</p>}
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="mt-3 max-w-3xl text-muted leading-relaxed">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, toneClass = "" }: { label: string; value: string; sub?: string; toneClass?: string }) {
  return (
    <div className="rounded-md border border-rule bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold num ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Section({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2 mb-4">
        <h2 className="font-serif text-xl sm:text-2xl font-semibold">{title}</h2>
        {href && <Link href={href} className="text-sm text-accent hover:underline whitespace-nowrap">{linkLabel ?? "See all"} →</Link>}
      </div>
      {children}
    </section>
  );
}

export function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{children}</a>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" | "accent" }) {
  const cls = tone === "warn" ? "bg-warn-soft text-neg" : tone === "accent" ? "bg-accent-soft text-accent" : "bg-paper text-muted border border-rule";
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}
