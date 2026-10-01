"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, LoaderCircle, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { PAGE_SIZES, SORT_OPTIONS, STATUS_META, TYPE_META } from "@/lib/constants";
import type { AccountStatus, AccountType, SubmitterOption } from "@/lib/types";

const TYPE_FILTERS: Array<{ value: "" | AccountType; label: string }> = [
  { value: "", label: "All" },
  { value: "NEW", label: "New" },
  { value: "BOT", label: "Bot" },
  { value: "OLD", label: "Old" },
];
const STATUS_FILTERS: Array<"" | AccountStatus> = ["", "PENDING", "APPROVED", "SOLD", "UNSOLD", "REJECTED"];

const TYPE_ACTIVE: Record<string, string> = {
  "": "bg-white text-navy-950",
  NEW: "bg-sky-400 text-navy-950",
  BOT: "bg-violet-400 text-navy-950",
  OLD: "bg-amber-400 text-navy-950",
};

/**
 * URL-driven filters: every change rewrites the query string and the server
 * re-runs the database query, so filtering/sorting/pagination stay server-side.
 */
export function FilterBar({
  submitters,
  showStatus = true,
  showType = true,
  showSort = true,
  dateLabel = "Added",
  searchPlaceholder = "Search ID, login email, PTC login, submitter…",
  lockedStatus,
}: {
  submitters?: SubmitterOption[];
  showStatus?: boolean;
  showType?: boolean;
  showSort?: boolean;
  dateLabel?: string;
  searchPlaceholder?: string;
  lockedStatus?: AccountStatus;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [showDates, setShowDates] = useState(Boolean(params.get("from") || params.get("to")));
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // Keep the input in sync when the URL changes elsewhere (e.g. header search).
  const urlQuery = params.get("q") ?? "";
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  const onSearch = (value: string) => {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => update({ q: value.trim() || null }), 350);
  };

  const type = params.get("type")?.toUpperCase() ?? "";
  const status = params.get("status")?.toUpperCase() ?? "";
  const sortValue = `${params.get("sort") ?? "created_at"}:${params.get("dir") ?? "desc"}`;
  const activeCount = ["q", "type", "status", "submitter", "from", "to"].filter((key) => params.get(key)).length;

  const reset = () => {
    setQuery("");
    setShowDates(false);
    startTransition(() => router.replace(pathname, { scroll: false }));
  };

  return (
    <div className="card relative p-3 sm:p-4" aria-busy={pending}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            {pending ? (
              <LoaderCircle className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-poke-yellow" />
            ) : (
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" />
            )}
            <input
              type="search"
              value={query}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Search accounts"
              className="input pl-10"
            />
          </div>

          {showType && (
            <div role="radiogroup" aria-label="Filter by type" className="flex shrink-0 rounded-xl border border-white/10 bg-navy-950/50 p-1">
              {TYPE_FILTERS.map((option) => {
                const active = type === option.value;
                return (
                  <button
                    key={option.value || "all"}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update({ type: option.value || null })}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition sm:flex-none ${
                      active ? `${TYPE_ACTIVE[option.value]} shadow` : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {option.value ? TYPE_META[option.value].label : option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {showStatus && !lockedStatus && (
            <select value={status} onChange={(event) => update({ status: event.target.value || null })} className="select sm:w-40" aria-label="Filter by status">
              {STATUS_FILTERS.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? STATUS_META[value].label : "All statuses"}
                </option>
              ))}
            </select>
          )}
          {submitters && (
            <select
              value={params.get("submitter") ?? ""}
              onChange={(event) => update({ submitter: event.target.value || null })}
              className="select sm:w-44"
              aria-label="Filter by submitter"
            >
              <option value="">All submitters</option>
              {submitters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.email}
                </option>
              ))}
            </select>
          )}
          {showSort && (
            <select
              value={sortValue}
              onChange={(event) => {
                const [sort, dir] = event.target.value.split(":");
                update({ sort, dir });
              }}
              className="select sm:w-44"
              aria-label="Sort accounts"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowDates((value) => !value)}
            className={`btn btn-ghost ${showDates ? "border-poke-sky/40 text-poke-sky" : ""}`}
            aria-expanded={showDates}
          >
            <CalendarRange className="size-4" /> Date
          </button>
          <button type="button" onClick={reset} disabled={activeCount === 0} className="btn btn-ghost">
            <RotateCcw className="size-4" /> Reset
            {activeCount > 0 && <span className="rounded-full bg-poke-yellow px-1.5 text-[10px] font-bold text-navy-950">{activeCount}</span>}
          </button>
        </div>
      </div>
      {showDates && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-white/[0.06] pt-3 animate-fade-up">
          <SlidersHorizontal className="mb-3 hidden size-4 text-slate-500 sm:block" />
          <div>
            <label className="label" htmlFor="filter-from">
              {dateLabel} from
            </label>
            <input
              id="filter-from"
              type="date"
              className="input w-44"
              value={params.get("from") ?? ""}
              max={params.get("to") ?? undefined}
              onChange={(event) => update({ from: event.target.value || null })}
            />
          </div>
          <div>
            <label className="label" htmlFor="filter-to">
              {dateLabel} to
            </label>
            <input
              id="filter-to"
              type="date"
              className="input w-44"
              value={params.get("to") ?? ""}
              min={params.get("from") ?? undefined}
              onChange={(event) => update({ to: event.target.value || null })}
            />
          </div>
          <div>
            <label className="label" htmlFor="filter-size">
              Per page
            </label>
            <select id="filter-size" className="select w-28" value={params.get("size") ?? "20"} onChange={(event) => update({ size: event.target.value === "20" ? null : event.target.value })}>
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
