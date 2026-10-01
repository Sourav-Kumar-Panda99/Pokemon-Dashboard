import type { Metadata } from "next";
import Link from "next/link";
import { History, Plus } from "lucide-react";
import { ActivityTimeline } from "@/components/activity/ActivityLog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { listMyActivity } from "@/lib/server/repo";
import { requireUser } from "@/lib/server/session";
import { parsePage, type SearchParams } from "@/lib/validation";

export const metadata: Metadata = { title: "Submission History" };
const PAGE_SIZE = 20;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const params = await searchParams;
  const page = parsePage(params);
  const history = await listMyActivity(page, PAGE_SIZE);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="My submissions" title="Submission History" icon={History} description="Every update to the accounts you submitted, newest first." />
      <Panel>
        {history.rows.length ? (
          <ActivityTimeline entries={history.rows} viewerId={user.id} accountHref={(id) => `/dashboard/accounts/${id}`} />
        ) : (
          <EmptyState
            variant="activity"
            title="No history yet"
            description="Submit an account to start your journey."
            action={
              <Link href="/dashboard/submit" className="btn btn-primary">
                <Plus className="size-4" /> Submit Account
              </Link>
            }
          />
        )}
      </Panel>
      {history.total > 0 && <Pagination basePath="/dashboard/history" params={params} page={page} pageSize={PAGE_SIZE} total={history.total} noun="events" />}
    </div>
  );
}
