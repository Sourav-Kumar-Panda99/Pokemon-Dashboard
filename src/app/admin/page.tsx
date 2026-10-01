import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Backpack, BadgeDollarSign, Bot, CalendarCheck, CircleX, ClipboardList, Clock, Hourglass, Plus, Sparkles } from "lucide-react";
import { ActivityTimeline } from "@/components/activity/ActivityLog";
import { AccountTable } from "@/components/accounts/AccountTable";
import { FilterBar } from "@/components/accounts/FilterBar";
import { QuickActions } from "@/components/accounts/QuickActions";
import { HeroBanner, HeroChip } from "@/components/HeroBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Panel } from "@/components/ui/Panel";
import { StatCard } from "@/components/ui/StatCard";
import { formatNumber } from "@/lib/format";
import { getAccountStats, listAccounts, listActivity, listSubmitters } from "@/lib/server/repo";
import { requireAdmin } from "@/lib/server/session";
import { parseAccountQuery, type SearchParams } from "@/lib/validation";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAdmin();
  const params = await searchParams;
  const query = parseAccountQuery(params);
  const [stats, accounts, submitters, activity] = await Promise.all([
    getAccountStats(),
    listAccounts(query),
    listSubmitters(),
    listActivity({ size: 6 }),
  ]);
  const share = (n: number) => (stats.total ? n / stats.total : 0);
  const firstName = user.fullName.split(" ")[0];

  return (
    <div className="space-y-6">
      <HeroBanner
        eyebrow={`Welcome back, ${firstName}`}
        title={
          <>
            Manage Your <span className="text-gradient-gold">Pokémon GO</span> Accounts
          </>
        }
        subtitle="Organize, review and manage your account inventory."
        actions={
          <>
            <Link href="/admin/accounts/new" className="btn btn-primary h-11 px-5">
              <Plus className="size-4" strokeWidth={3} /> Add Account
            </Link>
            <Link href="/admin/pending" className="btn btn-ghost h-11 border-white/20 bg-white/10 px-5 text-white">
              <Hourglass className="size-4 text-poke-yellow" /> Review Pending
              {stats.pending > 0 && <span className="rounded-full bg-poke-yellow px-2 py-0.5 text-[11px] font-bold text-navy-950">{stats.pending}</span>}
            </Link>
          </>
        }
        chips={
          <>
            <HeroChip>
              <Backpack className="size-3.5" /> {formatNumber(stats.total)} in inventory
            </HeroChip>
            <HeroChip tone="yellow">
              <Sparkles className="size-3.5" /> {formatNumber(stats.added_this_week)} added this week
            </HeroChip>
            <HeroChip>
              <BadgeDollarSign className="size-3.5" /> {formatNumber(stats.sold_this_month)} sold this month
            </HeroChip>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Total Accounts" value={stats.total} icon={Backpack} tone="yellow" href="/admin/accounts" hint="All" />
          <StatCard label="New IDs" value={stats.new} icon={Sparkles} tone="sky" href="/admin/accounts?type=NEW" share={share(stats.new)} />
          <StatCard label="Bot IDs" value={stats.bot} icon={Bot} tone="violet" href="/admin/accounts?type=BOT" share={share(stats.bot)} />
          <StatCard label="Old IDs" value={stats.old} icon={Clock} tone="amber" href="/admin/accounts?type=OLD" share={share(stats.old)} />
          <StatCard label="Sold" value={stats.sold} icon={BadgeDollarSign} tone="rose" href="/admin/accounts?status=SOLD" share={share(stats.sold)} />
          <StatCard label="Pending" value={stats.pending} icon={Hourglass} tone="yellow" href="/admin/pending" share={share(stats.pending)} hint={stats.pending ? "In stock" : undefined} />
          <StatCard label="Rejected" value={stats.rejected} icon={CircleX} tone="slate" href="/admin/accounts?status=REJECTED" />
          <StatCard label="Sold This Month" value={stats.sold_this_month} icon={CalendarCheck} tone="blue" href="/admin/sales" />
        </div>
        <Suspense>
          <QuickActions pending={stats.pending} sold={stats.sold} />
        </Suspense>
      </div>

      <section className="space-y-4" aria-labelledby="inventory-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="inventory-heading" className="font-display text-xl font-semibold text-white">
              Account Inventory
            </h2>
            <p className="text-sm text-slate-400">Search, filter and act on every account.</p>
          </div>
          <Link href="/admin/accounts" className="text-sm font-semibold text-poke-sky hover:text-white">
            Open full view →
          </Link>
        </div>
        <Suspense>
          <FilterBar submitters={submitters} />
        </Suspense>
        <Suspense>
          <AccountTable
            rows={accounts.rows}
            role="ADMIN"
            base="/admin"
            emptyState={
              <EmptyState
                title="No accounts found"
                description="Nothing matches these filters. Try a different search or reset the filters."
                action={
                  <Link href="/admin" className="btn btn-ghost">
                    Reset filters
                  </Link>
                }
              />
            }
          />
        </Suspense>
        {accounts.total > 0 && <Pagination basePath="/admin" params={params} page={query.page} pageSize={query.size} total={accounts.total} />}
      </section>

      <Panel
        title="Recent Activity"
        icon={ClipboardList}
        actions={
          <Link href="/admin/activity" className="text-sm font-semibold text-poke-sky hover:text-white">
            View all logs →
          </Link>
        }
      >
        {activity.rows.length ? (
          <ActivityTimeline entries={activity.rows} viewerId={user.id} accountHref={(id) => `/admin/accounts/${id}`} />
        ) : (
          <EmptyState compact variant="activity" title="No activity yet" />
        )}
      </Panel>
    </div>
  );
}
