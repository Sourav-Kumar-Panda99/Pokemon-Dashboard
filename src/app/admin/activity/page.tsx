import type { Metadata } from "next";
import { Suspense } from "react";
import { ClipboardList, ShieldCheck } from "lucide-react";
import { ActivityLogTable } from "@/components/activity/ActivityLog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/Panel";
import { ACTION_LABELS } from "@/lib/activity";
import { listActivity } from "@/lib/server/repo";
import { requireAdmin } from "@/lib/server/session";
import type { ActivityAction } from "@/lib/types";
import { parseDate, parsePage, parseText, type SearchParams } from "@/lib/validation";
import { ActivityFilters } from "./ActivityFilters";

export const metadata: Metadata = { title: "Activity Logs" };
const PAGE_SIZE = 25;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdmin();
  const params = await searchParams;
  const page = parsePage(params);
  const actionParam = parseText(params, "action");
  const action = actionParam && actionParam in ACTION_LABELS ? (actionParam as ActivityAction) : undefined;
  const log = await listActivity({ q: parseText(params, "q"), action, from: parseDate(params, "from"), to: parseDate(params, "to"), page, size: PAGE_SIZE });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Audit trail"
        title="Activity Logs"
        icon={ClipboardList}
        description={
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-emerald-400" /> Append-only. Passwords and other secrets are never written to the log.
          </span>
        }
      />
      <section className="card overflow-hidden">
        <Suspense>
          <ActivityFilters />
        </Suspense>
        {log.rows.length ? (
          <ActivityLogTable entries={log.rows} />
        ) : (
          <EmptyState variant="activity" title="No activity found" description="Nothing matches these filters." />
        )}
      </section>
      {log.total > 0 && <Pagination basePath="/admin/activity" params={params} page={page} pageSize={PAGE_SIZE} total={log.total} noun="events" />}
    </div>
  );
}
