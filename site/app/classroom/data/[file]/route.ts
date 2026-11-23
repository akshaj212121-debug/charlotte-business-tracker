// Classroom CSV downloads, generated at build time from the same JSON the site renders.
import { dataPacks, getPack, toCsv } from "@/lib/classroom";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return dataPacks.map((p) => ({ file: `${p.slug}.csv` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const pack = getPack(file.replace(/\.csv$/, ""));
  if (!pack) return new Response("Not found", { status: 404 });
  // UTF-8 byte-order mark so Excel opens names with accents correctly; Sheets and Python ignore it.
  return new Response("﻿" + toCsv(pack), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${pack.slug}.csv"`,
    },
  });
}
