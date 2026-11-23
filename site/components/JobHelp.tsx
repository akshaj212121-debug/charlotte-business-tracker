// Job-help links for laid-off workers. Content lives in lib/jobHelp.ts.
import { SourceLink } from "@/components/ui";
import { date } from "@/lib/format";
import { COUNTY_HELP, JOB_HELP_CHECKED, STATEWIDE_HELP, type HelpLink } from "@/lib/jobHelp";

function HelpItem({ h }: { h: HelpLink }) {
  return (
    <li className="rounded-md border border-rule bg-card p-4">
      <p className="font-medium"><SourceLink href={h.href}>{h.name}</SourceLink></p>
      <p className="mt-1 text-sm text-muted leading-relaxed">{h.what}</p>
      {h.phone && <p className="mt-1 text-sm">Phone: <a href={`tel:${h.phone.replace(/\D/g, "")}`} className="num">{h.phone}</a></p>}
    </li>
  );
}

export function StatewideHelp() {
  return (
    <>
      <ul className="grid sm:grid-cols-2 gap-3">
        {STATEWIDE_HELP.map((h) => <HelpItem key={h.href} h={h} />)}
      </ul>
      <p className="mt-3 text-xs text-muted">Links and phone numbers checked on {date(JOB_HELP_CHECKED)}. Each description is taken from the linked page.</p>
    </>
  );
}

export function CountyHelp({ county }: { county: string }) {
  const help = COUNTY_HELP[county];
  if (!help || (help.centers.length === 0 && help.other.length === 0)) {
    return (
      <p className="text-sm text-muted">
        We have not confirmed an NCWorks Career Center in {county} County. Use the{" "}
        <SourceLink href="https://www.ncworks.gov/vosnet/ContactUs.aspx?tab=2">NCWorks Career Center finder</SourceLink> to find the nearest one.
      </p>
    );
  }
  return (
    <>
      <ul className="grid sm:grid-cols-2 gap-3">
        {help.centers.map((c) => (
          <li key={c.name} className="rounded-md border border-rule bg-card p-4">
            <p className="font-medium">{c.name}</p>
            <p className="mt-1 text-sm text-muted">{c.address}</p>
            <p className="mt-1 text-sm">Phone: <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="num">{c.phone}</a></p>
            <p className="mt-1 text-xs text-muted">Source: <SourceLink href={c.source}>NC Careers.org center list</SourceLink></p>
          </li>
        ))}
        {help.other.map((h) => <HelpItem key={h.href} h={h} />)}
      </ul>
      <p className="mt-3 text-xs text-muted">Call ahead to confirm hours. Checked on {date(JOB_HELP_CHECKED)}.</p>
    </>
  );
}
