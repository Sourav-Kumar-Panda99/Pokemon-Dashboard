"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { CaptureBall } from "@/components/art/CaptureBall";
import { Avatar } from "@/components/ui/Avatar";
import { ROLE_META } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import type { CurrentUser } from "@/lib/types";
import { ADMIN_NAV, SUBMITTER_NAV, type NavItem } from "./nav";

export type SidebarMode = "expanded" | "responsive" | "collapsed";
export type NavCounters = Partial<Record<NonNullable<NavItem["counter"]>, number>>;

function useActiveHref(items: NavItem[]) {
  const pathname = usePathname();
  const search = useSearchParams();
  let best: { href: string; score: number } | null = null;
  for (const item of items) {
    const [path, query] = item.href.split("?");
    const isRoot = path === "/admin" || path === "/dashboard";
    const pathMatch = pathname === path || (!isRoot && pathname.startsWith(`${path}/`));
    if (!pathMatch) continue;
    const params = new URLSearchParams(query ?? "");
    let ok = true;
    for (const [key, value] of params) if (search.get(key)?.toUpperCase() !== value) ok = false;
    if (!ok) continue;
    const score = path.length + [...params].length * 100;
    if (!best || score > best.score) best = { href: item.href, score };
  }
  return best?.href ?? null;
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative inline-flex">
        <span className="absolute inset-0 rounded-full bg-poke-yellow/30 blur-md" />
        <CaptureBall size={38} className="relative drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[22px] font-bold tracking-wide italic">
            <span className="text-gradient-gold drop-shadow-[0_2px_0_rgba(23,59,140,0.9)]">GO</span>
            <span className="ml-1.5 text-white">ACCOUNT</span>
          </span>
          <span className="mt-1 block text-[10px] font-bold tracking-[0.42em] text-poke-sky/90">MANAGER</span>
        </span>
      )}
    </div>
  );
}

export function Sidebar({
  user,
  counters,
  mode,
  onToggleCollapse,
  onNavigate,
}: {
  user: CurrentUser;
  counters: NavCounters;
  mode: SidebarMode;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const sections = user.role === "ADMIN" ? ADMIN_NAV : SUBMITTER_NAV;
  const activeHref = useActiveHref(sections.flatMap((s) => s.items));
  const label = mode === "expanded" ? "" : mode === "responsive" ? "hidden lg:inline" : "hidden";
  const block = mode === "expanded" ? "" : mode === "responsive" ? "hidden lg:block" : "hidden";
  const railOnly = mode === "collapsed" ? "" : mode === "responsive" ? "lg:hidden" : "hidden";

  return (
    <div className="relative flex h-full flex-col overflow-hidden border-r border-white/[0.06] bg-gradient-to-b from-[#0b1940] via-navy-900 to-[#060e26]">
      {/* map decorations */}
      <div className="map-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 size-72 rounded-full border-[28px] border-white/[0.025]" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 size-72">
        <div className="absolute inset-x-0 top-1/2 h-6 -translate-y-1/2 bg-white/[0.025]" />
      </div>
      <div className="pointer-events-none absolute top-24 -right-16 size-40 rounded-full bg-poke-blue/20 blur-3xl" />

      <div className={`relative flex h-[72px] shrink-0 items-center ${mode === "collapsed" ? "justify-center px-0" : "px-5"} ${mode === "responsive" ? "justify-center px-0 lg:justify-start lg:px-5" : ""}`}>
        <Link href={user.role === "ADMIN" ? "/admin" : "/dashboard"} onClick={onNavigate} aria-label="GO Account Manager home" className="rounded-xl focus-visible:outline-2 focus-visible:outline-poke-yellow">
          <span className={block}>
            <BrandMark />
          </span>
          <span className={railOnly}>
            <BrandMark compact />
          </span>
        </Link>
      </div>

      <nav aria-label="Main navigation" className="relative flex-1 space-y-5 overflow-y-auto px-3 py-3 scrollbar-thin">
        {sections.map((section, i) => (
          <div key={i}>
            {section.title && (
              <p className={`mb-2 px-3 text-[10px] font-bold tracking-[0.22em] text-slate-500 uppercase ${block}`}>{section.title}</p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = item.href === activeHref;
                const count = item.counter ? counters[item.counter] : undefined;
                // Queues that need the admin's attention get the highlighted counter.
                const urgent = item.counter === "pending" || item.counter === "approvals";
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={mode === "expanded" ? undefined : item.label}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold transition duration-200 ${
                        mode === "collapsed" ? "justify-center" : mode === "responsive" ? "justify-center lg:justify-start" : ""
                      } ${
                        active
                          ? "bg-gradient-to-r from-poke-blue/30 to-poke-blue/5 text-white shadow-[inset_0_0_0_1px_rgba(79,195,255,0.25)]"
                          : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      {active && <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-poke-yellow shadow-[0_0_12px_rgba(255,203,5,0.9)]" />}
                      <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition group-hover:scale-105 ${item.accent}`}>
                        <item.icon className="size-[17px]" strokeWidth={2.3} />
                      </span>
                      <span className={`flex-1 truncate ${label}`}>{item.label}</span>
                      {count !== undefined && count > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${label} ${
                            urgent ? "bg-poke-yellow text-navy-950" : "bg-white/10 text-slate-300"
                          }`}
                        >
                          {formatNumber(count)}
                        </span>
                      )}
                      {count !== undefined && count > 0 && urgent && (
                        <span className={`absolute top-1.5 right-1.5 size-2 rounded-full bg-poke-yellow ${railOnly}`} />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="relative border-t border-white/[0.06] p-3">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="mb-2 hidden w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-white/5 hover:text-slate-200 lg:flex"
            aria-label={mode === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
          >
            {mode === "collapsed" ? <PanelLeftOpen className="mx-auto size-4" /> : <PanelLeftClose className="size-4" />}
            <span className={label}>Collapse sidebar</span>
          </button>
        )}
        <div
          className={`flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-2.5 ${
            mode === "collapsed" ? "flex-col" : mode === "responsive" ? "flex-col lg:flex-row" : ""
          }`}
        >
          <Avatar name={user.fullName} seed={user.id} size="md" />
          <div className={`min-w-0 flex-1 ${block}`}>
            <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
            <p className="truncate text-[11px] font-semibold text-poke-yellow/90">{ROLE_META[user.role].label}</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="icon-btn hover:text-rose-300" aria-label="Log out" title="Log out">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
