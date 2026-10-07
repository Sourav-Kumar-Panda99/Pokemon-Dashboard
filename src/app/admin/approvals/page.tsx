import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Banknote, CheckCheck } from "lucide-react";
import { AccountTable } from "@/components/accounts/AccountTable";
import { ApproveSalesButton } from "@/components/accounts/ApproveSalesButton";
import { FilterBar } from "@/components/accounts/FilterBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/Panel";
import { formatNumber } from "@/lib/format";
import { listAccounts, listSubmitters } from "@/lib/server/repo";
import { requireAdmin } from "@/lib/server/session";
import { parseAccountQuery, type SearchParams } from "@/lib/validation";

export const metadata: Metadata = { title: "Sales to Approve" };

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const params = await searchParams;
  // Sales recorded by suppliers that no admin has approved yet — oldest sale first.
  const query = { ...parseAccountQuery(params, { sort: "sold_at", dir: "asc" }), status: "SOLD" as const, approval: "AWAITING" as const };
  const [sales, submitters] = await Promise.all([listAccounts({ ...query, dateField: "sold_at" }), listSubmitters()]);
  const filtered = Boolean(query.q || query.type || query.submitter || query.from || query.to);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Records"
        title="Sales to Approve"
        icon={CheckCheck}
        description={
          <>
            <span className="font-semibold text-amber-200">{formatNumber(sales.total)}</span> sale{sales.total === 1 ? "" : "s"} recorded by suppliers
            {sales.total === 1 ? " is" : " are"} waiting for your approval. Approving only confirms the sale for your records.
          </>
        }
        actions={
          <>
            <Link href="/admin/sales" className="btn btn-ghost">
              <Banknote className="size-4" /> Sales report
            </Link>
            <ApproveSalesButton ids={sales.rows.map((row) => row.id)} />
          </>
        }
      />
      <Suspense>
        <FilterBar submitters={submitters} lockedStatus="SOLD" dateLabel="Sold" showSort={false} />
      </Suspense>
      <Suspense>
        <AccountTable
          rows={sales.rows}
          role="ADMIN"
          base="/admin"
          showSale
          emptyState={
            filtered ? (
              <EmptyState
                title="No sales match"
                description="No sale waiting for approval matches these filters."
                action={
                  <Link href="/admin/approvals" className="btn btn-ghost">
                    Reset filters
                  </Link>
                }
              />
            ) : (
              <EmptyState
                variant="sales"
                title="Nothing to approve"
                description="All caught up! Sales recorded by your suppliers will appear here."
                action={
                  <Link href="/admin/sales" className="btn btn-ghost">
                    View sales
                  </Link>
                }
              />
            )
          }
        />
      </Suspense>
      {sales.total > 0 && <Pagination basePath="/admin/approvals" params={params} page={query.page} pageSize={query.size} total={sales.total} noun="sales to approve" />}
    </div>
  );
}
