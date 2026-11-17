import type { Metadata } from "next";
import SortableTable, { type Column, type Row } from "@/components/SortableTable";
import { PageTitle, Section, SourceLink, Stat } from "@/components/ui";
import { privateData } from "@/lib/data";
import { date, money } from "@/lib/format";

export const metadata: Metadata = { title: "Federal contracts", description: "The largest federal contractors located in North Carolina and the newest contract awards." };

export default function ContractsPage() {
  const { completed, prior, current } = privateData.fiscalYears;
  const total = privateData.contractors.reduce((s, c) => s + ((c[completed] as number) ?? 0), 0);
  const columns: Column[] = [
    { key: "name", label: "Contractor", kind: "text" },
    { key: completed, label: completed, kind: "money" },
    { key: prior, label: prior, kind: "money" },
    { key: "growth", label: "Change", kind: "signedPct", tone: true },
    { key: `${current}ytd`, label: `${current} to date`, kind: "money" },
  ];
  const rows: Row[] = privateData.contractors.map((c) => ({
    name: c.name,
    [completed]: c[completed] as number,
    [prior]: (c[prior] as number) ?? null,
    growth: c.growth,
    [`${current}ytd`]: (c[`${current}ytd`] as number) ?? null,
    href: c.source,
  }));

  return (
    <>
      <PageTitle kicker="USAspending.gov" title="Federal contracts in North Carolina">
        Private companies don’t publish financial statements, but federal contract dollars are public. These are the
        largest contract recipients with a North Carolina address, by obligations in the {completed} federal fiscal year
        (October to September). Names link to each recipient’s USAspending profile.
      </PageTitle>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        <Stat label={`Top-100 obligations, ${completed}`} value={money(total)} />
        <Stat label="Contractors listed" value={String(privateData.contractors.length)} />
        <Stat label="New awards, last 60 days" value={String(privateData.newAwards.length)} />
      </div>
      <SortableTable columns={columns} rows={rows} searchKeys={["name"]} initialSort={completed} placeholder="Search contractor" />

      <Section title="Newest large contract awards (last 60 days)">
        {privateData.newAwards.length === 0 ? <p className="text-muted text-sm">No new contract awards in the window.</p> : (
          <ul className="divide-y divide-rule rounded-md border border-rule bg-card">
            {privateData.newAwards.map((a) => (
              <li key={a.awardId} className="px-3 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{a.recipient}</span>
                  <span className="num font-semibold">{money(a.amount)}</span>
                </div>
                <p className="text-muted mt-1">{a.agency} · starts {date(a.startDate)} · <SourceLink href={a.source}>Award {a.awardId}</SourceLink></p>
                {a.description && <p className="mt-1 text-muted line-clamp-2">{a.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
