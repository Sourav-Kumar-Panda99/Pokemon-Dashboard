import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Backpack, BadgeDollarSign, CheckCheck, CircleX, History, Hourglass, Plus } from "lucide-react";
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
        subtitle="Submit accounts, mark them sold when you sell them and follow the admin's approval."
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
          stats.pending > 0 || stats.sold_unapproved > 0 ? (
            <>
              {stats.pending > 0 && (
                <HeroChip tone="yellow">
                  <Hourglass className="size-3.5" /> {formatNumber(stats.pending)} in stock, ready to sell
                </HeroChip>
              )}
              {stats.sold_unapproved > 0 && (
                <HeroChip>
                  <CheckCheck className="size-3.5" /> {formatNumber(stats.sold_unapproved)} sale{stats.sold_unapproved === 1 ? "" : "s"} awaiting admin approval
                </HeroChip>
              )}
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="My Accounts" value={stats.total} icon={Backpack} tone="yellow" href="/dashboard" />
        <StatCard label="Pending" value={stats.pending} icon={Hourglass} tone="yellow" href="/dashboard?status=PENDING" hint={stats.pending ? "In stock" : undefined} />
        <StatCard
          label="Sold"
          value={stats.sold}
          icon={BadgeDollarSign}
          tone="rose"
          href="/dashboard?status=SOLD"
          hint={stats.sold_unapproved ? `${formatNumber(stats.sold_unapproved)} awaiting approval` : undefined}
        />
        <StatCard label="Rejected" value={stats.rejected} icon={CircleX} tone="slate" href="/dashboard?status=REJECTED" />
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
                  description="Submit your first account. Once you sell it, mark it as sold here and an admin approves the sale."
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
