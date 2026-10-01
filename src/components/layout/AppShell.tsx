"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import type { CurrentUser, NotificationFeed } from "@/lib/types";
import { Header } from "./Header";
import { Sidebar, type NavCounters } from "./Sidebar";

const COLLAPSE_KEY = "gam:sidebar-collapsed";

export function AppShell({
  user,
  counters,
  notifications,
  demoMode,
  children,
}: {
  user: CurrentUser;
  counters: NavCounters;
  notifications: NotificationFeed;
  demoMode: boolean;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a per-device preference after hydration
      if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const toggleCollapse = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !value;
    });
  };

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only z-[300] rounded-lg bg-poke-yellow px-3 py-2 font-semibold text-navy-950 focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>

      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-300 ease-out md:block ${
          collapsed ? "w-[76px]" : "w-[76px] lg:w-[268px]"
        }`}
      >
        <Suspense>
          <Sidebar user={user} counters={counters} mode={collapsed ? "collapsed" : "responsive"} onToggleCollapse={toggleCollapse} />
        </Suspense>
      </aside>

      {/* mobile drawer */}
      <div className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? "" : "pointer-events-none"}`} aria-hidden={!mobileOpen}>
        <div
          className={`absolute inset-0 bg-navy-950/70 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={`absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-2xl transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          {mobileOpen && (
            <Suspense>
              <Sidebar user={user} counters={counters} mode="expanded" onNavigate={() => setMobileOpen(false)} />
            </Suspense>
          )}
          <button type="button" className="icon-btn absolute top-5 right-3 bg-navy-900/80" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className={`transition-[padding] duration-300 ease-out ${collapsed ? "md:pl-[76px]" : "md:pl-[76px] lg:pl-[268px]"}`}>
        <Header
          user={user}
          notifications={notifications}
          pendingCount={counters.pending ?? 0}
          demoMode={demoMode}
          onOpenMenu={() => setMobileOpen(true)}
        />
        <main id="main" className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
