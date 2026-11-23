import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPack, packHref } from "@/lib/classroom";
import { privateData } from "@/lib/data";
import { date } from "@/lib/format";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { getWorksheet, worksheets } from "../worksheets";

export const dynamicParams = false;

export function generateStaticParams() {
  return worksheets.map((w) => ({ worksheet: w.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ worksheet: string }> }): Promise<Metadata> {
  const w = getWorksheet((await params).worksheet);
  return w ? { title: `${w.title} (classroom worksheet)`, description: w.question } : {};
}

// Print layout: hide the site chrome and screen-only controls, and start the teacher guide on a new page.
const printCss = `@media print {
  body > header, body > footer, .no-print { display: none !important; }
  html { font-size: 11px; }
  body { background: #fff; color: #000; }
  main { max-width: none; padding: 0; }
  .teacher-guide { break-before: page; border: 0 !important; padding: 0 !important; }
  a { color: inherit !important; }
}`;

export default async function WorksheetPage({ params }: { params: Promise<{ worksheet: string }> }) {
  const w = getWorksheet((await params).worksheet);
  if (!w) notFound();
  const { Student, Teacher } = w;
  const url = `${SITE_URL}/classroom/${w.slug}`;
  return (
    <>
      <style>{printCss}</style>
      <nav className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href="/classroom" className="text-accent hover:underline">← All classroom materials</Link>
        <span className="text-muted">Print this page (Ctrl+P or ⌘P): the student sheet prints first, the teacher guide on its own page.</span>
      </nav>

      <article className="max-w-3xl">
        <header className="border-b border-rule pb-3 mb-4">
          <p className="text-xs uppercase tracking-[0.16em] text-accent font-medium">{w.subjects.join(" · ")} · about {w.minutes} minutes</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight mt-1">{w.title}</h1>
          <p className="mt-2 text-sm">Name: ______________________ &nbsp; Class: ____________ &nbsp; Date: __________</p>
          <p className="mt-1 text-xs text-muted">{SITE_NAME} · {url} · Data: {w.packs.map((s) => getPack(s)?.source.label).join("; ")}</p>
        </header>
        <div className="space-y-2 leading-relaxed"><Student /></div>
      </article>

      <section className="teacher-guide max-w-3xl mt-12 rounded-md border border-rule bg-card p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-accent font-medium">Teacher guide</p>
        <h2 className="font-serif text-2xl font-semibold mt-1">{w.title}</h2>
        <p className="mt-1 text-sm text-muted">{w.question} Free to copy and adapt. Answers reflect the data as of {date(privateData.generatedAt)}.</p>
        <Teacher />
        <div className="mt-5 break-inside-avoid">
          <h3 className="font-semibold mb-1.5">Data and sources</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {w.packs.map((s) => {
              const p = getPack(s);
              return p && <li key={s}><a href={packHref(s)} className="text-accent underline underline-offset-2">{s}.csv</a> ({p.rows.length.toLocaleString("en-US")} rows). Source: <a href={p.source.href} className="underline">{p.source.label}</a>. Column meanings are on the <Link href="/classroom#data" className="underline">Classroom page</Link>.</li>;
            })}
          </ul>
        </div>
      </section>
    </>
  );
}
