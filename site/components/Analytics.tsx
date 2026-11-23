// Vercel Web Analytics: page-view counts with no cookies. The script is served from this site's own domain
// (/_vercel/insights), so the Content-Security-Policy in next.config.ts needs no new sources.
// Off until ANALYTICS_ENABLED is set in lib/site.ts, and never loaded in local development.
import Script from "next/script";
import { ANALYTICS_ENABLED } from "@/lib/site";

export default function Analytics() {
  if (!ANALYTICS_ENABLED || process.env.NODE_ENV !== "production") return null;
  return <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />;
}
