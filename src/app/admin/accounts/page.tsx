import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Backpack, BadgeDollarSign, Bot, CircleX, Clock, Hourglass, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { AccountTable } from "@/components/accounts/AccountTable";
import { FilterBar } from "@/components/accounts/FilterBar";
import { TransferButtons } from "@/components/accounts/QuickActions";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/Panel";
import { STATUS_META, TYPE_META } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { listAccounts, listSubmitters } from "@/lib/server/repo";
import { requireAdmin } from "@/lib/server/session";
import { parseAccountQuery, type SearchParams } from "@/lib/validation";

export const metadata: Metadata = { title: "Accounts" };

const TYPE_HEADINGS: Record<string, { title: string; icon: LucideIcon; description: string }> = {
  NEW: { title: "New IDs", icon: Sparkles, description: "Newly created accounts in the inventory." },
  BOT: { title: "Bot IDs", icon: Bot, description: "Bot and automation accounts." },
  OLD: { title: "Old IDs", icon: Clock, description: "Aged, established accounts." },
};

export default async function AccountsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const params = await searchParams;
  const query = parseAccountQuery(params);
  const [accounts, submitters] = await Promise.all([listAccounts(query), listSubmitters()]);

  let heading = { title: "All Accounts", icon: Backpack as LucideIcon, description: "Every account across all submitters." };
  if (query.type && !query.status) heading = TYPE_HEADINGS[query.type];
  else if (query.status === "SOLD" && !query.type) heading = { title: "Sold Accounts", icon: BadgeDollarSign, description: "Accounts that have been sold." };
  else if (query.status === "PENDING" && !query.type) heading = { title: "Pending Accounts", icon: Hourglass, description: "In stock and not sold yet." };
  else if (query.status === "REJECTED" && !query.type) heading = { title: "Rejected Accounts", icon: CircleX, description: "Submissions that did not pass review." };
  else if (query.type || query.status) {
    heading = {
      title: [query.type && TYPE_META[query.type].label, query.status && STATUS_META[query.status].label].filter(Boolean).join(" · "),
      icon: Backpack,
      description: "Filtered inventory view.",
    };
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inventory"
        title={heading.title}
        icon={heading.icon}
        description={
          <>
            {heading.description} <span className="font-semibold text-slate-200">{formatNumber(accounts.total)}</span> found.
          </>
        }
        actions={
          <>
            <Suspense>
              <TransferButtons />
            </Suspense>
            <Link href="/admin/accounts/new" className="btn btn-primary">
              <Plus className="size-4" strokeWidth={3} /> Add Account
            </Link>
          </>
        }
      />
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
              description="No account matches these filters yet. Try another search, or add a new account."
              action={
                <div className="flex gap-2">
                  <Link href="/admin/accounts" className="btn btn-ghost">
                    Reset filters
                  </Link>
                  <Link href="/admin/accounts/new" className="btn btn-primary">
                    <Plus className="size-4" /> Add Account
                  </Link>
                </div>
              }
            />
          }
        />
      </Suspense>
      {accounts.total > 0 && <Pagination basePath="/admin/accounts" params={params} page={query.page} pageSize={query.size} total={accounts.total} />}
    </div>
  );
}
