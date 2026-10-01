"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { ACTION_LABELS } from "@/lib/activity";
import type { ActivityAction } from "@/lib/types";

export function ActivityFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    startTransition(() => router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false }));
  };

  return (
    <div className="flex flex-col gap-2 border-b border-white/[0.06] p-4 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => update({ q: value.trim() || null }), 350);
          }}
          placeholder="Search user, email or account #…"
          aria-label="Search activity"
          className="input pl-10"
        />
      </div>
      <select className="select lg:w-52" value={params.get("action") ?? ""} onChange={(e) => update({ action: e.target.value || null })} aria-label="Filter by action">
        <option value="">All actions</option>
        {(Object.keys(ACTION_LABELS) as ActivityAction[]).map((action) => (
          <option key={action} value={action}>
            {ACTION_LABELS[action]}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <input type="date" className="input w-full lg:w-40" value={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value || null })} aria-label="From date" />
        <input type="date" className="input w-full lg:w-40" value={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value || null })} aria-label="To date" />
      </div>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          setQuery("");
          startTransition(() => router.replace(pathname, { scroll: false }));
        }}
      >
        <RotateCcw className="size-4" /> Reset
      </button>
    </div>
  );
}
