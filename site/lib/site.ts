// Site-wide constants.
export const SITE_URL = "https://charlotte-business-tracker.vercel.app";
export const SITE_NAME = "Charlotte Business Tracker";

// Buttondown username for the email signup form. The form stays hidden until this is set
// (Akshaj creates the Buttondown account; nothing here collects emails until then).
export const BUTTONDOWN_USERNAME: string | null = "akshaj";

// Public contact address shown on the About and Corrections pages. Use an address made only for this
// site, never a personal or school email. Pages say "coming soon" until it is set.
export const CONTACT_EMAIL: string | null = null;

// Vercel Web Analytics (cookieless, same-origin script, so the strict CSP stays as is). Turn this on only
// after enabling Analytics for the project in the Vercel dashboard; until then the script would 404.
export const ANALYTICS_ENABLED = false;
