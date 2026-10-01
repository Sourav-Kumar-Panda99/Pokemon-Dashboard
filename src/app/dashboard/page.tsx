import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Backpack, BadgeDollarSign, CircleCheck, History, Hourglass, Package, Plus } from "lucide-react";
import { AccountTable } from "@/components/accounts/AccountTable";
import { FilterBar } from "@/components/accounts/FilterBar";
import { HeroBanner, HeroChip } from "@/components/HeroBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { StatCard } from "@/components/ui/StatCard";
import { formatNumber } from "@/lib/format";
import { getAccountStats, listAccounts } from "@/lib/server/repo";
import { requireUser } from "@/lib/server/session";
import { parseAccountQuery, type SearchParams } from "@/lib/validation";

export const metadata: Metadata = { title: "My Submissions" };

export default async function SubmitterDashboard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const params = await searchParams;
  const query = parseAccountQuery(params);
  // RLS scopes both queries to this user's own accounts.
  const [stats, accounts] = await Promise.all([getAccountStats(), listAccounts(query)]);
  const filtered = Boolean(query.q || query.type || query.status || query.from || query.to);

  return (
    <div className="space-y-6">
      <HeroBanner
        eyebrow={`Trainer ${user.fullName.split(" ")[0]}`}
        title={
          <>
            My Account <span className="text-gradient-gold">Submissions</span>
          </>
        }
        subtitle="Submit accounts, follow their review and see when they sell."
        actions={
          <>
            <Link href="/dashboard/submit" className="btn btn-primary h-11 px-5">
              <Plus className="size-4" strokeWidth={3} /> Submit Account
            </Link>
            <Link href="/dashboard/history" className="btn btn-ghost h-11 border-white/20 bg-white/10 px-5 text-white">
              <History className="size-4" /> Submission history
            </Link>
          </>
        }
        chips={
          stats.pending > 0 ? (
            <HeroChip tone="yellow">
              <Hourglass className="size-3.5" /> {formatNumber(stats.pending)} waiting for review
            </HeroChip>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="My Accounts" value={stats.total} icon={Backpack} tone="yellow" href="/dashboard" />
        <StatCard label="Pending" value={stats.pending} icon={Hourglass} tone="yellow" href="/dashboard?status=PENDING" />
        <StatCard label="Approved" value={stats.reviewed} icon={CircleCheck} tone="blue" hint="Passed review" />
        <StatCard label="Sold" value={stats.sold} icon={BadgeDollarSign} tone="rose" href="/dashboard?status=SOLD" />
        <StatCard label="Unsold" value={stats.unsold} icon={Package} tone="emerald" href="/dashboard?status=UNSOLD" />
      </div>

      <section className="space-y-4" aria-labelledby="my-accounts">
        <h2 id="my-accounts" className="font-display text-xl font-semibold text-white">
          My accounts
        </h2>
        <Suspense>
          <FilterBar searchPlaceholder="Search my accounts by ID, login email or PTC login…" dateLabel="Submitted" />
        </Suspense>
        <Suspense>
          <AccountTable
            rows={accounts.rows}
            role="SUBMITTER"
            base="/dashboard"
            emptyState={
              filtered ? (
                <EmptyState
                  title="No accounts found"
                  description="None of your submissions match these filters."
                  action={
                    <Link href="/dashboard" className="btn btn-ghost">
                      Reset filters
                    </Link>
                  }
                />
              ) : (
                <EmptyState
                  title="No submissions yet"
                  description="Submit your first account — an admin will review it and add it to the inventory."
                  action={
                    <Link href="/dashboard/submit" className="btn btn-primary">
                      <Plus className="size-4" /> Submit Account
                    </Link>
                  }
                />
              )
            }
          />
        </Suspense>
        {accounts.total > 0 && <Pagination basePath="/dashboard" params={params} page={query.page} pageSize={query.size} total={accounts.total} />}
      </section>
    </div>
  );
}
