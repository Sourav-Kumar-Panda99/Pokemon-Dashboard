import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, BadgeDollarSign, Backpack, CircleX, Hourglass } from "lucide-react";
import { AccountTable } from "@/components/accounts/AccountTable";
import { FilterBar } from "@/components/accounts/FilterBar";
import { Avatar } from "@/components/ui/Avatar";
import { ActiveBadge, RoleBadge } from "@/components/ui/Badges";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { StatCard } from "@/components/ui/StatCard";
import { UserActionButtons } from "@/components/users/UserActionButtons";
import { formatDate } from "@/lib/format";
import { getUserSummary, listAccounts, listUsers } from "@/lib/server/repo";
import { requireAdmin } from "@/lib/server/session";
import { parseAccountQuery, type SearchParams } from "@/lib/validation";

export const metadata: Metadata = { title: "User" };

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const search = await searchParams;
  const query = { ...parseAccountQuery(search), submitter: id };

  const [user, accounts, admins] = await Promise.all([getUserSummary(id), listAccounts(query), listUsers({ role: "ADMIN", active: true, size: 1 })]);
  if (!user) notFound();
  const isLastAdmin = user.role === "ADMIN" && user.is_active && admins.total <= 1;

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white">
        <ArrowLeft className="size-4" /> All users
      </Link>

      <section className="card relative overflow-hidden p-6 animate-fade-up">
        <div className="map-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <Avatar name={user.full_name} seed={user.id} size="xl" />
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
                {user.full_name}
                {user.id === admin.id && <span className="ml-2 text-base font-normal text-slate-500">(you)</span>}
              </h1>
              <p className="truncate text-sm text-slate-400">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RoleBadge role={user.role} />
                <ActiveBadge active={user.is_active} />
                <span className="text-xs text-slate-500">Joined {formatDate(user.created_at)}</span>
              </div>
            </div>
          </div>
          <UserActionButtons user={user} isSelf={user.id === admin.id} isLastAdmin={isLastAdmin} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Accounts Submitted" value={user.accounts_total} icon={Backpack} tone="yellow" />
        <StatCard label="Pending" value={user.accounts_pending} icon={Hourglass} tone="yellow" />
        <StatCard label="Sold" value={user.accounts_sold} icon={BadgeDollarSign} tone="rose" />
        <StatCard label="Rejected" value={user.accounts_rejected} icon={CircleX} tone="slate" />
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-white">Submitted accounts</h2>
        <Suspense>
          <FilterBar />
        </Suspense>
        <Suspense>
          <AccountTable
            rows={accounts.rows}
            role="ADMIN"
            base="/admin"
            emptyState={<EmptyState title="No accounts found" description="This user has no accounts matching the filters." />}
          />
        </Suspense>
        {accounts.total > 0 && <Pagination basePath={`/admin/users/${id}`} params={search} page={query.page} pageSize={query.size} total={accounts.total} />}
      </section>
    </div>
  );
}
