import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeDollarSign, Banknote, CalendarCheck, ChartColumn, Coins, Package, PackageOpen, Shapes, Wallet } from "lucide-react";
import { AccountTable } from "@/components/accounts/AccountTable";
import { FilterBar } from "@/components/accounts/FilterBar";
import { MonthlySalesChart } from "@/components/sales/MonthlySalesChart";
import { AccountTypeBadge } from "@/components/ui/Badges";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { StatCard } from "@/components/ui/StatCard";
import { ACCOUNT_TYPES, TYPE_META } from "@/lib/constants";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { getSalesOverview, listAccounts, listSubmitters } from "@/lib/server/repo";
import { requireAdmin } from "@/lib/server/session";
import { parseAccountQuery, type SearchParams } from "@/lib/validation";

export const metadata: Metadata = { title: "Sales" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const params = await searchParams;
  const query = { ...parseAccountQuery(params, { sort: "sold_at", dir: "desc" }), status: "SOLD" as const };
  const [overview, sold, submitters] = await Promise.all([
    getSalesOverview(query.from, query.to),
    listAccounts({ ...query, dateField: "sold_at" }),
    listSubmitters(),
  ]);
  const soldTotal = Math.max(overview.total_sold, 1);
  const ranged = Boolean(query.from || query.to);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management"
        title="Sales"
        icon={Banknote}
        description="Track sold inventory, monthly performance and what is still available."
        actions={
          <Link href="/admin/accounts?status=UNSOLD" className="btn btn-ghost">
            <Package className="size-4" /> Available inventory
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total Sold" value={overview.total_sold} icon={BadgeDollarSign} tone="rose" />
        <StatCard label="Total Unsold" value={overview.total_unsold} icon={Package} tone="emerald" />
        <StatCard label="Sold This Month" value={overview.sold_this_month} icon={CalendarCheck} tone="blue" />
        <StatCard label="Available Inventory" value={overview.available} icon={PackageOpen} tone="sky" hint="Unsold + approved" />
        <StatCard label="Revenue (all time)" value={formatCurrency(overview.revenue_total)} icon={Wallet} tone="yellow" />
        <StatCard label="Revenue this month" value={formatCurrency(overview.revenue_this_month)} icon={Coins} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Accounts sold per month" icon={ChartColumn} description="Last 12 months · hover a column for details" className="xl:col-span-2">
          <MonthlySalesChart data={overview.monthly} />
        </Panel>
        <Panel title="Sold by type" icon={Shapes} description={`${formatNumber(overview.total_sold)} sold accounts`}>
          <ul className="space-y-5">
            {ACCOUNT_TYPES.map((type) => {
              const count = overview.sold_by_type[type] ?? 0;
              return (
                <li key={type}>
                  <div className="flex items-center justify-between">
                    <AccountTypeBadge type={type} />
                    <span className="text-sm font-semibold text-white tabular-nums">
                      {formatNumber(count)} <span className="font-normal text-slate-500">· {Math.round((count / soldTotal) * 100)}%</span>
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                    <div className={`h-full rounded-full ${TYPE_META[type].dot}`} style={{ width: `${(count / soldTotal) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-semibold text-white">Sold accounts</h2>
            <p className="text-sm text-slate-400">
              {ranged ? (
                <>
                  {formatNumber(overview.sold_in_range)} sold between {query.from ? formatDate(query.from) : "the beginning"} and {query.to ? formatDate(query.to) : "today"}.
                </>
              ) : (
                "Use the Date filter to narrow by sale date."
              )}
            </p>
          </div>
        </div>
        <Suspense>
          <FilterBar submitters={submitters} lockedStatus="SOLD" dateLabel="Sold" showSort={false} />
        </Suspense>
        <Suspense>
          <AccountTable
            rows={sold.rows}
            role="ADMIN"
            base="/admin"
            showSale
            emptyState={<EmptyState variant="sales" title="No sales found" description="No sold accounts match these filters yet." />}
          />
        </Suspense>
        {sold.total > 0 && <Pagination basePath="/admin/sales" params={params} page={query.page} pageSize={query.size} total={sold.total} noun="sold accounts" />}
      </section>
    </div>
  );
}
