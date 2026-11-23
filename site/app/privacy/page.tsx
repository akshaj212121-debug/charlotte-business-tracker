import type { Metadata } from "next";
import { PageTitle, Section, SourceLink } from "@/components/ui";
import { ANALYTICS_ENABLED, BUTTONDOWN_USERNAME, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", description: "What the Charlotte Business Tracker collects about visitors and subscribers, and what it does not." };

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl">
      <PageTitle kicker="Privacy" title="Privacy">
        Short version: no accounts, no cookies, no ads, no tracking across other sites, and your email is used
        only to send the newsletter.
      </PageTitle>

      <Section title="Reading the site">
        <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
          <li>The site sets no cookies and has no advertising or social-media trackers. Fonts are served from this site, not from a third party.</li>
          <li>
            {ANALYTICS_ENABLED
              ? <>Visits are counted with <SourceLink href="https://vercel.com/docs/analytics/privacy-policy">Vercel Web Analytics</SourceLink>, which records page views, referring sites, country and device type in aggregate. It uses no cookies and is not used to identify you.</>
              : <>The site does not currently run analytics. If it starts, it will use a cookieless tool that counts page views in aggregate, and this page will say so.</>}
          </li>
          <li>The site is hosted on Vercel, which, like any web host, processes basic request data such as IP addresses to deliver pages and protect against abuse. See <SourceLink href="https://vercel.com/legal/privacy-policy">Vercel’s privacy policy</SourceLink>.</li>
        </ul>
      </Section>

      <Section title="The newsletter">
        <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
          {BUTTONDOWN_USERNAME
            ? <li>If you subscribe, your email address is stored by <SourceLink href="https://buttondown.com/legal/privacy">Buttondown</SourceLink>, the newsletter service, and used only to send this newsletter.</li>
            : <li>Email signup is not open yet. When it opens, addresses will be stored by the newsletter service and used only to send this newsletter.</li>}
          <li>Your address is never sold, shared or used for advertising.</li>
          <li>Every email has an unsubscribe link. You can also ask for your address to be deleted.</li>
          <li>The RSS feed needs no signup at all.</li>
        </ul>
      </Section>

      <Section title="People and companies in the records">
        <p className="text-sm leading-relaxed">
          The site republishes information that is already public: filings with the SEC and IRS, federal contract
          records and state WARN notices. It does not collect personal data about private individuals beyond what
          those records name, such as a company officer listed in a filing.
        </p>
      </Section>

      <Section title="Questions">
        <p className="text-sm leading-relaxed">
          {CONTACT_EMAIL ? <>Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent underline">{CONTACT_EMAIL}</a>.</> : <>A contact address is coming soon.</>}
        </p>
      </Section>
    </article>
  );
}
