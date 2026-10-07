import type { ReactNode } from "react";
import { getBackendMode } from "@/lib/backend";
import { getAccountStats, listNotifications } from "@/lib/server/repo";
import type { CurrentUser } from "@/lib/types";
import { AppShell } from "./AppShell";

/** Server wrapper: loads sidebar counters + notifications for the shell. */
export async function ShellLayout({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const [stats, notifications] = await Promise.all([
    getAccountStats(),
    listNotifications(8).catch(() => ({ unread: 0, rows: [] })),
  ]);
  return (
    <AppShell
      user={user}
      counters={{ pending: stats.pending, total: stats.total, sold: stats.sold, approvals: stats.sold_unapproved }}
      notifications={notifications}
      demoMode={getBackendMode() === "demo"}
    >
      {children}
    </AppShell>
  );
}
