"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui";
import { date } from "@/lib/format";

export interface NewsSummary { id: string; date: string; category: string; headline: string; dek: string; tone: "warn" | "accent" | "neutral" }

export default function NewsList({ items, categories }: { items: NewsSummary[]; categories: string[] }) {
  const [cat, setCat] = useState<string | null>(null);
  const shown = cat ? items.filter((i) => i.category === cat) : items;
  const used = categories.filter((c) => items.some((i) => i.category === c));
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by category">
        {[null, ...used].map((c) => (
          <button
            key={c ?? "all"}
            type="button"
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            className={`rounded-full border px-3 py-1 text-xs ${cat === c ? "border-accent bg-accent-soft text-accent" : "border-rule text-muted hover:text-ink"}`}
          >
            {c ?? "All"}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-rule border-y border-rule">
        {shown.map((n) => (
          <li key={n.id} className="py-4">
            <p className="text-xs text-muted num flex items-center gap-2">{date(n.date)} <Badge tone={n.tone}>{n.category}</Badge></p>
            <Link href={`/news/${n.id}`} className="block font-serif text-lg sm:text-xl font-semibold mt-1 hover:text-accent">{n.headline}</Link>
            <p className="text-muted mt-1 text-sm leading-relaxed">{n.dek}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
