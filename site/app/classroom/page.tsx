import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle, Section, SourceLink } from "@/components/ui";
import { dataPacks, packHref } from "@/lib/classroom";
import { privateData } from "@/lib/data";
import { date } from "@/lib/format";
import { worksheets } from "./worksheets";

export const metadata: Metadata = {
  title: "Classroom",
  description: "Free data packs and one-page worksheets built on real North Carolina public records, for economics, statistics and personal finance classes.",
};

export default function ClassroomPage() {
  return (
    <>
      <PageTitle kicker="Free for teachers and students" title="Classroom">
        <p>
          Real numbers from North Carolina companies, nonprofits, federal contracts and layoff notices, packaged for
          economics, statistics and personal finance classes. Every file is free, needs no sign-up, and every row links
          to the public record it came from. Nothing is estimated.
        </p>
      </PageTitle>

      <Section title="Worksheets">
        <p className="text-sm text-muted mb-4">Each is one printable page for students plus a teacher guide with an answer key computed from the current data.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {worksheets.map((w) => (
            <Link key={w.slug} href={`/classroom/${w.slug}`} className="block rounded-md border border-rule bg-card p-4 hover:border-accent">
              <p className="text-xs uppercase tracking-wide text-muted">{w.subjects.join(" · ")} · {w.minutes} min</p>
              <p className="font-serif text-lg font-semibold mt-1">{w.title}</p>
              <p className="text-sm text-muted mt-1">{w.question}</p>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Reading for students">
        <Link href="/federal-money" className="block rounded-md border border-rule bg-card p-4 hover:border-accent max-w-2xl">
          <p className="font-serif text-lg font-semibold">Where federal contract money goes in your county</p>
          <p className="text-sm text-muted mt-1">A plain-English explainer of federal contracts in Mecklenburg and Union counties, what the numbers mean, what they leave out, and how to look up any county.</p>
        </Link>
      </Section>

      <section id="data" className="mt-12 scroll-mt-6">
        <div className="border-b border-rule pb-2 mb-4">
          <h2 className="font-serif text-xl sm:text-2xl font-semibold">Data packs (CSV)</h2>
        </div>
        <p className="text-sm text-muted mb-4">
          Open in Google Sheets, Excel, Desmos, CODAP or Python. Dollar figures are whole dollars, not millions. Blank cells
          mean the source does not report that value. Files rebuild with each monthly data refresh; this version was built
          from data pulled {date(privateData.generatedAt)}.
        </p>
        <div className="space-y-6">
          {dataPacks.map((p) => (
            <div key={p.slug} className="rounded-md border border-rule bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="font-semibold">{p.title}</h3>
                <a href={packHref(p.slug)} download className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-card hover:opacity-90">Download {p.slug}.csv</a>
              </div>
              <p className="text-sm mt-1">{p.summary}</p>
              <p className="text-xs text-muted mt-1">{p.rows.length.toLocaleString("en-US")} rows · {p.columns.length} columns · Good for: {p.goodFor.join("; ")} · Source: <SourceLink href={p.source.href}>{p.source.label}</SourceLink></p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-accent">What each column means</summary>
                <div className="mt-2 overflow-x-auto"><table className="w-full text-sm">
                  <tbody>
                    {p.columns.map((c) => (
                      <tr key={c.name} className="border-b border-rule last:border-0 align-top">
                        <td className="py-1.5 pr-4 font-mono text-xs whitespace-nowrap">{c.name}</td>
                        <td className="py-1.5 text-muted">{c.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </details>
            </div>
          ))}
        </div>
      </section>

      <Section title="Using these files">
        <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed max-w-3xl">
          <li>Free to use, copy and adapt for teaching. A credit line (“Data: Charlotte Business Tracker, from public records”) is appreciated, not required.</li>
          <li>Figures are as filed. Companies and agencies sometimes revise them later; the source link in each row shows the current record.</li>
          <li>Private companies are not required to publish financials, so they are not in the company pack. The <Link href="/methodology" className="underline">methodology page</Link> explains what is and isn’t covered.</li>
        </ul>
      </Section>
    </>
  );
}
