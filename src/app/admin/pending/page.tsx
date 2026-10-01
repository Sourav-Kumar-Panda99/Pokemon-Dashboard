import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Hourglass } from "lucide-react";
import { FilterBar } from "@/components/accounts/FilterBar";
import { PendingReview } from "@/components/accounts/PendingReview";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/Panel";
import { formatNumber } from "@/lib/format";
import { listAccounts, listSubmitters } from "@/lib/server/repo";
import { requireAdmin } from "@/lib/server/session";
import { parseAccountQuery, type SearchParams } from "@/lib/validation";

export const metadata: Metadata = { title: "Pending Review" };

export default async function PendingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const params = await searchParams;
  // Oldest submissions first: first in, first reviewed.
  const query = { ...parseAccountQuery(params, { sort: "created_at", dir: "asc", size: 12 }), status: "PENDING" as const };
  const [accounts, submitters] = await Promise.all([listAccounts(query), listSubmitters()]);
  const filtered = Boolean(query.q || query.type || query.submitter || query.from || query.to);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Review queue"
        title="Pending Review"
        icon={Hourglass}
        description={
          <>
            <span className="font-semibold text-yellow-200">{formatNumber(accounts.total)}</span> submission{accounts.total === 1 ? "" : "s"} waiting.
            Approving moves an account to the inventory as Unsold.
          </>
        }
      />
      <Suspense>
        <FilterBar submitters={submitters} lockedStatus="PENDING" showSort={false} dateLabel="Submitted" />
      </Suspense>
      {accounts.rows.length === 0 ? (
        <div className="card">
          {filtered ? (
            <EmptyState
              title="No pending submissions match"
              description="Try a different search or clear the filters."
              action={
                <Link href="/admin/pending" className="btn btn-ghost">
                  Reset filters
                </Link>
              }
            />
          ) : (
            <EmptyState
              variant="pending"
              title="No pending submissions"
              description="All caught up! New submissions will appear here for review."
              action={
                <Link href="/admin/accounts?status=UNSOLD" className="btn btn-ghost">
                  View unsold inventory
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <PendingReview rows={accounts.rows} />
      )}
      {accounts.total > 0 && (
        <Pagination basePath="/admin/pending" params={params} page={query.page} pageSize={query.size} total={accounts.total} noun="pending submissions" />
      )}
    </div>
  );
}
