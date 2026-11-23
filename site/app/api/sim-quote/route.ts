// Latest-price proxy for the paper trading simulator. Uses FINNHUB_API_KEY from the server environment,
// so the key never reaches the browser. Returns 503 when no key is configured; the simulator then asks the
// visitor for their own free key instead. Check Finnhub's terms before enabling this on a public site:
// the free plan is meant for personal use, and showing its data to the public may need a paid licence.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SYMBOL = /^[A-Z][A-Z0-9.\-]{0,9}$/;

export async function GET(req: Request) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return NextResponse.json({ error: "no-server-key" }, { status: 503 });

  const symbol = (new URL(req.url).searchParams.get("symbol") ?? "").toUpperCase();
  if (!SYMBOL.test(symbol)) return NextResponse.json({ error: "bad-symbol" }, { status: 400 });

  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`, {
      next: { revalidate: 15 }, // share one upstream call per symbol per 15 s across visitors (free plan: 60 calls/min)
    });
    if (res.status === 429) return NextResponse.json({ error: "rate-limited" }, { status: 429 });
    if (!res.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });
    const q = await res.json();
    if (!q || typeof q.c !== "number" || q.c <= 0) return NextResponse.json({ error: "unknown-symbol" }, { status: 404 });
    return NextResponse.json(
      { symbol, price: q.c, change: q.d, changePct: q.dp, prevClose: q.pc, open: q.o, high: q.h, low: q.l, time: q.t },
      { headers: { "Cache-Control": "public, s-maxage=15" } },
    );
  } catch {
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }
}
