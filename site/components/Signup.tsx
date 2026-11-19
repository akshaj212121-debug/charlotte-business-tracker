// Subscribe box: RSS always; email only once a Buttondown account is configured in lib/site.ts.
import { BUTTONDOWN_USERNAME } from "@/lib/site";

export default function Signup() {
  return (
    <section className="rounded-md border border-rule bg-card p-4" aria-labelledby="subscribe">
      <h2 id="subscribe" className="font-serif text-lg font-semibold">Get each issue</h2>
      {BUTTONDOWN_USERNAME ? (
        <form
          action={`https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USERNAME}`}
          method="post"
          target="_blank"
          className="mt-2 flex flex-col sm:flex-row gap-2"
        >
          <label htmlFor="bd-email" className="sr-only">Email address</label>
          <input id="bd-email" type="email" name="email" required autoComplete="email" placeholder="you@example.com"
            className="flex-1 rounded-md border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent" />
          <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:opacity-90">Subscribe</button>
        </form>
      ) : null}
      <p className="text-sm text-muted mt-2">
        {BUTTONDOWN_USERNAME ? "Emails are handled by Buttondown and used only to send this newsletter. Unsubscribe from any issue. " : ""}
        Or follow the <a href="/feed.xml" className="text-accent underline">RSS feed</a> in any feed reader.
      </p>
    </section>
  );
}
