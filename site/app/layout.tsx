import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";
import Analytics from "@/components/Analytics";
import { getNews } from "@/lib/news";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif4" });

export const metadata: Metadata = {
  title: { default: "Charlotte Business Tracker — North Carolina Financial Hub", template: "%s · Charlotte Business Tracker" },
  description: "Public-record financial profiles of North Carolina companies, nonprofits, federal contractors and layoffs. Every figure linked to its source filing. Updated monthly.",
  metadataBase: new URL(SITE_URL),
  alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: "Charlotte Business Tracker newsletter" }] } },
};

const NAV = [
  { href: "/news", label: "News" },
  { href: "/issues", label: "Newsletter" },
  { href: "/charlotte", label: "Charlotte" },
  { href: "/region", label: "Counties & towns" },
  { href: "/companies", label: "Public companies" },
  { href: "/earnings", label: "Earnings" },
  { href: "/models", label: "Stock models" },
  { href: "/nonprofits", label: "Nonprofits" },
  { href: "/contracts", label: "Federal contracts" },
  { href: "/layoffs", label: "Layoffs" },
  { href: "/classroom", label: "Classroom" },
  { href: "/methodology", label: "Methodology" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body className="min-h-screen">
        <header className="border-b border-rule bg-card">
          <div className="mx-auto max-w-6xl px-4 pt-5 pb-3">
            <Link href="/" className="block">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">North Carolina · Public-record financial hub</p>
              <p className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight">Charlotte Business Tracker</p>
            </Link>
            <nav aria-label="Main" className="mt-3 -mx-4 overflow-x-auto px-4">
              <ul className="flex gap-5 text-sm whitespace-nowrap">
                {/* Hide the News tab until the daily pipeline has published at least one story. */}
                {NAV.filter((n) => n.href !== "/news" || getNews().length > 0).map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className="text-muted hover:text-ink">{n.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="border-t border-rule mt-16">
          <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted space-y-2 leading-relaxed">
            <p>
              Every figure on this site comes from a public record: SEC filings, IRS Form 990s, USAspending.gov and the
              NC Department of Commerce. Each profile links to its source. Private companies are not required to publish
              financials, and this site never estimates them. <Link href="/methodology" className="underline">How this works</Link>.
            </p>
            <p>Not investment advice. Figures are as filed and may be restated later by the filer. <a href="/feed.xml" className="underline">RSS feed</a>.</p>
            <p><Link href="/about" className="underline">About</Link> · <Link href="/corrections" className="underline">Corrections</Link> · <Link href="/privacy" className="underline">Privacy</Link></p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
