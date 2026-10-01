"use client";

import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  CircleCheck,
  CircleX,
  Hourglass,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Search,
  Settings,
  Tag,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { markNotificationsReadAction } from "@/app/actions/users";
import { Avatar } from "@/components/ui/Avatar";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { ROLE_META } from "@/lib/constants";
import { formatNumber, formatRelative } from "@/lib/format";
import type { CurrentUser, NotificationFeed } from "@/lib/types";

export function Header({
  user,
  notifications,
  pendingCount,
  demoMode,
  onOpenMenu,
}: {
  user: CurrentUser;
  notifications: NotificationFeed;
  pendingCount: number;
  demoMode: boolean;
  onOpenMenu: () => void;
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const isAdmin = user.role === "ADMIN";
  const base = isAdmin ? "/admin" : "/dashboard";
  const unread = notifications.unread + (isAdmin && pendingCount > 0 ? 1 : 0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const markAllRead = () =>
    startTransition(async () => {
      await markNotificationsReadAction();
    });

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-navy-950/75 backdrop-blur-xl">
      <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" className="icon-btn size-10 md:hidden" onClick={onOpenMenu} aria-label="Open navigation">
          <MenuIcon className="size-5" />
        </button>

        <Form action={isAdmin ? "/admin/accounts" : "/dashboard"} className="relative max-w-xl flex-1" role="search">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" />
          <input
            ref={searchRef}
            name="q"
            type="search"
            placeholder={isAdmin ? "Search ID, login email, PTC login or submitter…" : "Search my accounts…"}
            aria-label="Search accounts"
            className="input h-11 rounded-2xl bg-white/[0.04] pr-12 pl-10"
            autoComplete="off"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block">
            /
          </kbd>
        </Form>

        <div className="ml-auto flex items-center gap-2">
          {demoMode && (
            <span className="hidden rounded-full border border-poke-sky/30 bg-poke-sky/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-poke-sky lg:inline">
              DEMO DATA
            </span>
          )}
          <Link href={isAdmin ? "/admin/accounts/new" : "/dashboard/submit"} className="btn btn-primary hidden h-10 sm:inline-flex">
            <Plus className="size-4" strokeWidth={3} />
            {isAdmin ? "Add Account" : "Submit Account"}
          </Link>

          <Menu
            label="Notifications"
            panelClassName="w-[min(22rem,calc(100vw-2rem))]"
            trigger={({ toggle, open }) => (
              <button type="button" className="icon-btn relative size-10" onClick={toggle} aria-expanded={open} aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
                {unread > 0 ? <BellRing className="size-5 text-poke-yellow" /> : <Bell className="size-5" />}
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-poke-red px-1 text-[10px] font-bold text-white ring-2 ring-navy-950">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            )}
          >
            {(close) => (
              <div>
                <div className="flex items-center justify-between px-3 py-2">
                  <p className="font-display text-sm font-semibold text-white">Notifications</p>
                  {notifications.unread > 0 && (
                    <button type="button" onClick={markAllRead} disabled={pending} className="inline-flex items-center gap-1 text-xs font-semibold text-poke-sky hover:text-white">
                      <CheckCheck className="size-3.5" /> Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-96 space-y-1 overflow-y-auto scrollbar-thin">
                  {isAdmin && pendingCount > 0 && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        close();
                        router.push("/admin/pending");
                      }}
                      className="flex w-full items-start gap-3 rounded-xl bg-poke-yellow/10 px-3 py-2.5 text-left ring-1 ring-poke-yellow/20 hover:bg-poke-yellow/15"
                    >
                      <Hourglass className="mt-0.5 size-4 shrink-0 text-poke-yellow" />
                      <span>
                        <span className="block text-sm font-semibold text-white">{formatNumber(pendingCount)} submissions awaiting review</span>
                        <span className="block text-xs text-slate-400">Open the review queue</span>
                      </span>
                    </button>
                  )}
                  {notifications.rows.length === 0 && !(isAdmin && pendingCount > 0) && (
                    <p className="px-3 py-6 text-center text-sm text-slate-400">You&apos;re all caught up.</p>
                  )}
                  {notifications.rows.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        close();
                        if (!n.read_at) startTransition(async () => void (await markNotificationsReadAction([n.id])));
                        if (n.account_id) router.push(`${base}/accounts/${n.account_id}`);
                      }}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.06]"
                    >
                      {n.kind === "APPROVED" ? (
                        <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                      ) : n.kind === "REJECTED" ? (
                        <CircleX className="mt-0.5 size-4 shrink-0 text-slate-400" />
                      ) : (
                        <Tag className="mt-0.5 size-4 shrink-0 text-rose-400" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-white">{n.title}</span>
                          {!n.read_at && <span className="size-2 shrink-0 rounded-full bg-poke-sky" />}
                        </span>
                        <span className="block truncate text-xs text-slate-400">{n.body}</span>
                        <span className="block text-[11px] text-slate-500">{formatRelative(n.created_at)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Menu>

          <Menu
            label="Account menu"
            trigger={({ toggle, open }) => (
              <button type="button" onClick={toggle} aria-expanded={open} aria-label="Open account menu" className="flex items-center gap-2.5 rounded-2xl p-1 pr-2 transition hover:bg-white/[0.05]">
                <Avatar name={user.fullName} seed={user.id} size="sm" />
                <span className="hidden text-left leading-tight lg:block">
                  <span className="block max-w-36 truncate text-sm font-semibold text-white">{user.fullName}</span>
                  <span className="block text-[11px] font-semibold text-poke-yellow/90">{ROLE_META[user.role].label}</span>
                </span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
                  <p className="truncate text-xs text-slate-400">{user.email}</p>
                </div>
                <MenuDivider />
                <MenuItem
                  icon={<Settings />}
                  onSelect={() => {
                    close();
                    router.push(`${base}/settings`);
                  }}
                >
                  Settings
                </MenuItem>
                <form action={logoutAction}>
                  <button type="submit" role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-300 transition hover:bg-rose-500/10">
                    <LogOut className="size-4" /> Log out
                  </button>
                </form>
              </>
            )}
          </Menu>
        </div>
      </div>
    </header>
  );
}
