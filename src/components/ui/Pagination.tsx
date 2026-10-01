import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { SearchParams } from "@/lib/validation";

function hrefFor(basePath: string, params: SearchParams, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) if (v !== "") search.append(key, v);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function pageWindow(current: number, last: number): Array<number | "…"> {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set([1, last, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4, 5].forEach((p) => pages.add(p));
  if (current >= last - 2) [last - 4, last - 3, last - 2, last - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

/** Server-side pagination: "Showing 1–20 of 250 · Previous 1 2 3 4 5 Next". */
export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
  noun = "accounts",
}: {
  basePath: string;
  params: SearchParams;
  page: number;
  pageSize: number;
  total: number;
  noun?: string;
}) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, last);
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);
  const linkBase =
    "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border px-2.5 text-sm font-semibold transition";
  const idle = "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white";
  const disabled = "pointer-events-none border-white/5 text-slate-600";

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 px-1 sm:flex-row">
      <p className="text-sm text-slate-400">
        Showing <span className="font-semibold text-white">{formatNumber(start)}</span>–
        <span className="font-semibold text-white">{formatNumber(end)}</span> of{" "}
        <span className="font-semibold text-white">{formatNumber(total)}</span> {noun}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Link
          href={hrefFor(basePath, params, current - 1)}
          aria-disabled={current <= 1}
          className={`${linkBase} ${current <= 1 ? disabled : idle}`}
          scroll={false}
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Previous</span>
        </Link>
        {pageWindow(current, last).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-slate-500">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={hrefFor(basePath, params, p)}
              aria-current={p === current ? "page" : undefined}
              scroll={false}
              className={`${linkBase} ${
                p === current
                  ? "border-poke-yellow/60 bg-poke-yellow text-navy-950 shadow-[0_0_20px_-6px_rgba(255,203,5,0.8)]"
                  : idle
              }`}
            >
              {p}
            </Link>
          ),
        )}
        <Link
          href={hrefFor(basePath, params, current + 1)}
          aria-disabled={current >= last}
          className={`${linkBase} ${current >= last ? disabled : idle}`}
          scroll={false}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </nav>
  );
}
