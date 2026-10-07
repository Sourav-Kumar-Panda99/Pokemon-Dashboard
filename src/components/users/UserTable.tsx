"use client";

import Link from "next/link";
import { Ellipsis, Eye, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import { useState, useTransition } from "react";
import { setUserActiveAction, setUserRoleAction } from "@/app/actions/users";
import { Avatar } from "@/components/ui/Avatar";
import { ActiveBadge, RoleBadge } from "@/components/ui/Badges";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatNumber } from "@/lib/format";
import type { Role, UserRow } from "@/lib/types";

type PendingChange = { kind: "role"; user: UserRow; role: Role } | { kind: "active"; user: UserRow; active: boolean };

export function useUserActions() {
  const [change, setChange] = useState<PendingChange | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const confirm = () => {
    if (!change) return;
    startTransition(async () => {
      const result =
        change.kind === "role" ? await setUserRoleAction(change.user.id, change.role) : await setUserActiveAction(change.user.id, change.active);
      if (result.ok) {
        toast.success(result.message ?? "Saved");
        setChange(null);
      } else toast.error("Could not update user", result.error);
    });
  };

  const name = change?.user.full_name || change?.user.email;
  const dialog = (
    <ConfirmDialog
      open={change !== null}
      onCancel={() => setChange(null)}
      onConfirm={confirm}
      pending={pending}
      tone={change?.kind === "active" && !change.active ? "danger" : change?.kind === "role" && change.role === "ADMIN" ? "primary" : "blue"}
      title={
        change?.kind === "role"
          ? `Change ${name}'s role to ${change.role === "ADMIN" ? "Admin" : "Submitter"}?`
          : change?.active
            ? `Enable ${name}?`
            : `Disable ${name}?`
      }
      description={
        change?.kind === "role"
          ? change.role === "ADMIN"
            ? "Admins can see every account, reveal credentials, manage users and read the activity log."
            : "They will lose access to the admin area and only see their own submissions."
          : change?.active
            ? "They will be able to sign in and see their submissions again."
            : "They will be signed out of all data immediately and cannot sign in. Their accounts stay in the inventory."
      }
      confirmLabel={change?.kind === "role" ? "Change Role" : change?.active ? "Enable" : "Disable"}
    />
  );

  return { request: setChange, dialog };
}

export function UserTable({ users, currentUserId, activeAdmins }: { users: UserRow[]; currentUserId: string; activeAdmins: number }) {
  const { request, dialog } = useUserActions();

  const isLastAdmin = (user: UserRow) => user.role === "ADMIN" && user.is_active && activeAdmins <= 1;

  const actions = (user: UserRow) => {
    const self = user.id === currentUserId;
    return (
      <div className="flex items-center justify-end gap-1">
        <Link href={`/admin/users/${user.id}`} className="icon-btn" aria-label={`View ${user.full_name}`} title="View">
          <Eye className="size-4" />
        </Link>
        <Menu
          label={`Manage ${user.full_name}`}
          trigger={({ toggle, open }) => (
            <button type="button" className="icon-btn" onClick={toggle} aria-expanded={open} aria-label={`Manage ${user.full_name}`}>
              <Ellipsis className="size-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              {user.role === "SUBMITTER" ? (
                <MenuItem tone="warning" icon={<ShieldCheck />} onSelect={() => (close(), request({ kind: "role", user, role: "ADMIN" }))}>
                  Make Admin
                </MenuItem>
              ) : (
                <MenuItem icon={<ShieldOff />} disabled={isLastAdmin(user)} onSelect={() => (close(), request({ kind: "role", user, role: "SUBMITTER" }))}>
                  {isLastAdmin(user) ? "Last admin — can't demote" : "Make Submitter"}
                </MenuItem>
              )}
              <MenuDivider />
              {user.is_active ? (
                <MenuItem tone="danger" icon={<UserX />} disabled={self || isLastAdmin(user)} onSelect={() => (close(), request({ kind: "active", user, active: false }))}>
                  {self ? "You can't disable yourself" : "Disable user"}
                </MenuItem>
              ) : (
                <MenuItem tone="success" icon={<UserCheck />} onSelect={() => (close(), request({ kind: "active", user, active: true }))}>
                  Enable user
                </MenuItem>
              )}
            </>
          )}
        </Menu>
      </div>
    );
  };

  return (
    <>
      <div className="hidden overflow-x-auto md:block scrollbar-thin">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-white/[0.07] bg-white/[0.02] text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            <tr>
              <th scope="col" className="px-5 py-3">Name</th>
              <th scope="col" className="px-3 py-3">Email</th>
              <th scope="col" className="px-3 py-3">Role</th>
              <th scope="col" className="px-3 py-3 text-right">Accounts Submitted</th>
              <th scope="col" className="px-3 py-3">Status</th>
              <th scope="col" className="px-3 py-3">Created</th>
              <th scope="col" className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {users.map((user) => (
              <tr key={user.id} className={`transition hover:bg-white/[0.03] ${user.is_active ? "" : "opacity-60"}`}>
                <td className="px-5 py-3">
                  <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3 font-semibold text-white hover:text-poke-sky">
                    <Avatar name={user.full_name} seed={user.id} size="sm" />
                    <span className="truncate">
                      {user.full_name}
                      {user.id === currentUserId && <span className="ml-1.5 text-xs font-normal text-slate-500">(you)</span>}
                    </span>
                  </Link>
                </td>
                <td className="max-w-[220px] truncate px-3 py-3 text-slate-300">{user.email}</td>
                <td className="px-3 py-3">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <span className="font-semibold text-white">{formatNumber(user.accounts_total)}</span>
                  {user.accounts_pending > 0 && <span className="ml-2 text-xs text-yellow-300">{user.accounts_pending} pending</span>}
                </td>
                <td className="px-3 py-3">
                  <ActiveBadge active={user.is_active} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-slate-400">{formatDate(user.created_at)}</td>
                <td className="px-5 py-2.5">{actions(user)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-white/[0.05] md:hidden">
        {users.map((user) => (
          <li key={user.id} className="flex items-center gap-3 px-4 py-3.5">
            <Avatar name={user.full_name} seed={user.id} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{user.full_name}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <RoleBadge role={user.role} />
                <ActiveBadge active={user.is_active} />
                <span className="text-xs text-slate-400">{user.accounts_total} accounts</span>
              </div>
            </div>
            {actions(user)}
          </li>
        ))}
      </ul>
      {dialog}
    </>
  );
}
