import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck, UserCheck, Users, UserX } from "lucide-react";
import { UserTable } from "@/components/users/UserTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/Panel";
import { StatCard } from "@/components/ui/StatCard";
import { listUsers } from "@/lib/server/repo";
import { requireAdmin } from "@/lib/server/session";
import type { Role } from "@/lib/types";
import { parsePage, parseText, type SearchParams } from "@/lib/validation";
import { UserFilters } from "./UserFilters";

export const metadata: Metadata = { title: "Submitters & Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const page = parsePage(params);
  const roleParam = parseText(params, "role");
  const role: Role | undefined = roleParam === "ADMIN" || roleParam === "SUBMITTER" ? roleParam : undefined;
  const statusParam = parseText(params, "status");
  const active = statusParam === "active" ? true : statusParam === "disabled" ? false : undefined;

  const [users, all, disabled, admins] = await Promise.all([
    listUsers({ q: parseText(params, "q"), role, active, page, size: 20 }),
    listUsers({ size: 1 }),
    listUsers({ active: false, size: 1 }),
    listUsers({ role: "ADMIN", active: true, size: 1 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Management" title="Submitters & Users" icon={Users} description="Manage access, roles and account status for every trainer." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total users" value={all.total} icon={Users} tone="sky" />
        <StatCard label="Active admins" value={admins.total} icon={ShieldCheck} tone="yellow" />
        <StatCard label="Active users" value={all.total - disabled.total} icon={UserCheck} tone="emerald" />
        <StatCard label="Disabled" value={disabled.total} icon={UserX} tone="rose" />
      </div>
      <section className="card overflow-hidden">
        <Suspense>
          <UserFilters />
        </Suspense>
        {users.rows.length ? (
          <UserTable users={users.rows} currentUserId={admin.id} activeAdmins={users.active_admins} />
        ) : (
          <EmptyState variant="users" title="No users found" description="Try a different search or filter." />
        )}
      </section>
      {users.total > 0 && <Pagination basePath="/admin/users" params={params} page={page} pageSize={20} total={users.total} noun="users" />}
    </div>
  );
}
