// Job help for workers named in WARN notices. Every entry was checked on the linked page
// on 2026-11-22. Re-check links and phone numbers at each monthly refresh (see MONTHLY-REFRESH.md).
import { REGION_COUNTIES } from "@/lib/data";

export const JOB_HELP_CHECKED = "2026-11-22";

export interface HelpLink {
  name: string;
  what: string;
  href: string;
  phone?: string;
  source: string; // page the description and phone number were checked against
}

// Statewide help, in the order a laid-off worker usually needs it.
export const STATEWIDE_HELP: HelpLink[] = [
  {
    name: "File for unemployment insurance (NC DES)",
    what: "Apply online through MyNCUIBenefits or by phone. The NC Division of Employment Security runs unemployment benefits.",
    href: "https://des.nc.gov/apply-unemployment/filing-your-unemployment-application",
    phone: "888-737-0259",
    source: "https://des.nc.gov/apply-unemployment/filing-your-unemployment-application",
  },
  {
    name: "Rapid Response (NC Commerce)",
    what: "NC Commerce's program for workers facing a layoff or closure. It says a team is sent within 48 hours of a WARN notice to help workers reach services such as NCWorks training.",
    href: "https://www.commerce.nc.gov/business/business-closure-resources/rapid-response-support-workers",
    phone: "800-562-6333",
    source: "https://www.commerce.nc.gov/business/business-closure-resources/rapid-response-support-workers",
  },
  {
    name: "NCWorks Online",
    what: "The state's job search site. Register here to search jobs and book help at a career center.",
    href: "https://www.ncworks.gov",
    source: "https://www.commerce.nc.gov/jobs-training/resources-job-seekers/ncworks-career-centers",
  },
  {
    name: "Find an NCWorks Career Center",
    what: "Free in-person help with job search, résumés and training. NC Commerce says there are more than 70 centers statewide.",
    href: "https://www.ncworks.gov/vosnet/ContactUs.aspx?tab=2",
    source: "https://www.commerce.nc.gov/jobs-training/resources-job-seekers/ncworks-career-centers",
  },
  {
    name: "Rapid Response guides (NCWorks Mobile Unit)",
    what: "Free guides including “How to Survive Financially After a Job Loss” and “Retirement and Health Care Coverage”.",
    href: "https://mobileunit.ncworks.gov/RapidResponse",
    source: "https://mobileunit.ncworks.gov/RapidResponse",
  },
  {
    name: "My Skills My Future",
    what: "A career tool NC Commerce lists for workers who have been laid off or want to change careers.",
    href: "https://www.myskillsmyfuture.org/",
    source: "https://www.commerce.nc.gov/jobs-training/resources-job-seekers",
  },
];

const CENTERS_SOURCE = "https://nccareers.org/ncworks-career-centers";

export interface CountyHelp {
  centers: { name: string; address: string; phone: string; source: string }[];
  other: HelpLink[];
}

// NCWorks Career Centers by county, from the NC Careers.org center list. Anson has no center in
// that list, so its page points to the statewide locator instead.
export const COUNTY_HELP: Record<string, CountyHelp> = {
  Mecklenburg: {
    centers: [{ name: "NCWorks Career Center – Charlotte", address: "8601 McAlpine Park Drive, Suite 110, Charlotte", phone: "704-501-3538", source: CENTERS_SOURCE }],
    other: [{
      name: "Charlotte Works",
      what: "Charlotte's local workforce board. The City of Charlotte lists it as overseeing the NCWorks Career Centers here.",
      href: "https://www.charlottenc.gov/Growth-and-Development/Office-of-Workforce-Development/Program-Directory/Charlotte-Works",
      phone: "980-201-3256",
      source: "https://www.charlottenc.gov/Growth-and-Development/Office-of-Workforce-Development/Program-Directory/Charlotte-Works",
    }],
  },
  Union: { centers: [{ name: "NCWorks Career Center – Union County", address: "Monroe", phone: "980-397-6400", source: CENTERS_SOURCE }], other: [] },
  Cabarrus: { centers: [{ name: "NCWorks Career Center – Cabarrus County", address: "Concord", phone: "980-407-6075", source: CENTERS_SOURCE }], other: [] },
  Gaston: {
    centers: [{ name: "NCWorks Career Center – Gaston County", address: "300 South Firestone Street, Suite 100A, Gastonia", phone: "980-460-8240", source: CENTERS_SOURCE }],
    other: [{
      name: "Goodwill Gastonia Career Center",
      what: "A nonprofit career center (not part of NCWorks) offering résumé review, job search support and training enrollment.",
      href: "https://goodwillsp.org/gastonia-career-center/",
      phone: "704-916-1610",
      source: "https://goodwillsp.org/gastonia-career-center/",
    }],
  },
  Iredell: { centers: [{ name: "NCWorks Career Center – Iredell County", address: "Statesville", phone: "704-380-6970", source: CENTERS_SOURCE }], other: [] },
  Lincoln: { centers: [{ name: "NCWorks Career Center – Lincoln County", address: "Lincolnton", phone: "704-666-6631", source: CENTERS_SOURCE }], other: [] },
  Rowan: { centers: [{ name: "NCWorks Career Center – Rowan County", address: "Salisbury", phone: "980-305-6950", source: CENTERS_SOURCE }], other: [] },
  Anson: { centers: [], other: [] },
};

export const countySlug = (county: string) => county.toLowerCase().replace(/\s+/g, "-");
export const countyFromSlug = (slug: string) => REGION_COUNTIES.find((c) => countySlug(c) === slug);
