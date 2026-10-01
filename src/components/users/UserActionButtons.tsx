"use client";

import { ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import type { UserRow, UserSummary } from "@/lib/types";
import { useUserActions } from "./UserTable";

export function UserActionButtons({ user, isSelf, isLastAdmin }: { user: UserSummary; isSelf: boolean; isLastAdmin: boolean }) {
  const { request, dialog } = useUserActions();
  const row: UserRow = {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    created_at: user.created_at,
    accounts_total: user.accounts_total,
    accounts_pending: user.accounts_pending,
    accounts_sold: user.accounts_sold,
    last_submission_at: null,
  };

  return (
    <div className="flex flex-wrap gap-2">
      {user.role === "SUBMITTER" ? (
        <button type="button" className="btn btn-primary" onClick={() => request({ kind: "role", user: row, role: "ADMIN" })}>
          <ShieldCheck className="size-4" /> Make Admin
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={isLastAdmin}
          title={isLastAdmin ? "The last active admin cannot be demoted" : undefined}
          onClick={() => request({ kind: "role", user: row, role: "SUBMITTER" })}
        >
          <ShieldOff className="size-4" /> Make Submitter
        </button>
      )}
      {user.is_active ? (
        <button
          type="button"
          className="btn btn-ghost text-rose-300"
          disabled={isSelf || isLastAdmin}
          title={isSelf ? "You cannot disable your own account" : undefined}
          onClick={() => request({ kind: "active", user: row, active: false })}
        >
          <UserX className="size-4" /> Disable
        </button>
      ) : (
        <button type="button" className="btn btn-success" onClick={() => request({ kind: "active", user: row, active: true })}>
          <UserCheck className="size-4" /> Enable
        </button>
      )}
      {dialog}
    </div>
  );
}
