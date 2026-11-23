"use client";
import { useState } from "react";
import type { Side } from "./ModelLab";

/** For single-company models: lets the reader choose whether to run on Company A or B. */
export function useWhich(a: Side, b: Side | null) {
  const [pick, setPick] = useState<"a" | "b">("a");
  const s = pick === "b" && b ? b : a;
  const control = b ? (
    <div className="mb-4 inline-flex rounded border border-rule bg-card p-0.5 text-sm" role="group" aria-label="Run model on">
      {([["a", a], ["b", b]] as const).map(([k, side]) => (
        <button key={k} type="button" onClick={() => setPick(k)} aria-pressed={pick === k}
          className={`px-3 py-1 rounded ${pick === k ? "bg-accent text-paper" : "text-muted hover:text-ink"}`}>
          {side.c.ticker ?? side.c.name}
        </button>
      ))}
    </div>
  ) : null;
  return { s, control };
}
