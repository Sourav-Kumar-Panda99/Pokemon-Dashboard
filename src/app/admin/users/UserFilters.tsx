"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search } from "lucide-react";
import { useRef, useState, useTransition } from "react";

export function UserFilters() {
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
    <div className="flex flex-col gap-2 border-b border-white/[0.06] p-4 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (timer.current) clearTimeout(timer.current);
            const value = event.target.value;
            timer.current = setTimeout(() => update({ q: value.trim() || null }), 350);
          }}
          placeholder="Search name or email…"
          aria-label="Search users"
          className="input pl-10"
        />
      </div>
      <select className="select sm:w-40" value={params.get("role") ?? ""} onChange={(e) => update({ role: e.target.value || null })} aria-label="Filter by role">
        <option value="">All roles</option>
        <option value="ADMIN">Admins</option>
        <option value="SUBMITTER">Submitters</option>
      </select>
      <select className="select sm:w-40" value={params.get("status") ?? ""} onChange={(e) => update({ status: e.target.value || null })} aria-label="Filter by status">
        <option value="">Any status</option>
        <option value="active">Active</option>
        <option value="disabled">Disabled</option>
      </select>
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
