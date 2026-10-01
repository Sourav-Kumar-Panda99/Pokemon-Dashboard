import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { RoleBadge } from "@/components/ui/Badges";
import { ACTION_LABELS, describeActivity } from "@/lib/activity";
import { formatAccountId, formatDateTime, formatRelative } from "@/lib/format";
import type { ActivityEntry } from "@/lib/types";
import { ActivityIcon } from "./ActivityIcon";

/** Vertical timeline — account detail pages and submission history. */
export function ActivityTimeline({
  entries,
  viewerId,
  accountHref,
}: {
  entries: ActivityEntry[];
  viewerId?: string;
  accountHref?: (id: number) => string;
}) {
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-px before:bg-gradient-to-b before:from-white/15 before:to-transparent">
      {entries.map((entry) => (
        <li key={entry.id} className="relative flex gap-4">
          <ActivityIcon action={entry.action} />
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-sm text-slate-200">
              {describeActivity(entry, viewerId)}
              {accountHref && entry.account_ref && entry.account_exists !== false && (
                <>
                  {" "}
                  <Link href={accountHref(entry.account_ref)} className="font-semibold text-poke-sky hover:text-white">
                    View
                  </Link>
                </>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-500" title={formatDateTime(entry.created_at)}>
              {ACTION_LABELS[entry.action]} · {formatDateTime(entry.created_at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Admin audit table: User · Action · Account · Timestamp. */
export function ActivityLogTable({ entries }: { entries: ActivityEntry[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block scrollbar-thin">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-white/[0.07] bg-white/[0.02] text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            <tr>
              <th scope="col" className="px-5 py-3">User</th>
              <th scope="col" className="px-3 py-3">Action</th>
              <th scope="col" className="px-3 py-3">Account</th>
              <th scope="col" className="px-5 py-3 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-white/[0.03]">
                <td className="px-5 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={entry.actor_name ?? "System"} seed={entry.actor_id} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{entry.actor_name ?? "System"}</p>
                      {entry.actor_role && <RoleBadge role={entry.actor_role} />}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <ActivityIcon action={entry.action} size="sm" />
                    <span className="text-slate-200">{describeActivity(entry)}</span>
                  </div>
                </td>
                <td className="px-3 py-3 font-mono text-[13px]">
                  {entry.account_ref ? (
                    entry.account_exists ? (
                      <Link href={`/admin/accounts/${entry.account_ref}`} className="font-semibold text-poke-sky hover:text-white">
                        {formatAccountId(entry.account_ref)}
                      </Link>
                    ) : (
                      <span className="text-slate-500 line-through" title="Account deleted">
                        {formatAccountId(entry.account_ref)}
                      </span>
                    )
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap text-slate-400" title={formatDateTime(entry.created_at)}>
                  <span className="block text-slate-300">{formatRelative(entry.created_at)}</span>
                  <span className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-white/[0.05] md:hidden">
        {entries.map((entry) => (
          <li key={entry.id} className="flex gap-3 px-4 py-3.5">
            <ActivityIcon action={entry.action} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-200">{describeActivity(entry)}</p>
              <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(entry.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
