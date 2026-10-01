"use client";

import Link from "next/link";
import { BadgeDollarSign, Check, CircleCheck, CircleX, Copy, Ellipsis, Eye, Pencil, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { STATUS_ACTION_FROM, TYPE_META, STATUS_META } from "@/lib/constants";
import { formatAccountId } from "@/lib/format";
import type { AccountRow, Role } from "@/lib/types";
import type { AccountActionKind } from "./useAccountActions";

export function accountSummary(row: Pick<AccountRow, "id" | "login_email" | "ptc_login" | "type" | "status">) {
  return [
    formatAccountId(row.id),
    row.login_email,
    row.ptc_login ? `PTC: ${row.ptc_login}` : null,
    TYPE_META[row.type].label,
    STATUS_META[row.status].label.toUpperCase(),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function AccountRowActions({
  row,
  role,
  base,
  onAction,
  compact = false,
}: {
  compact?: boolean;
  row: AccountRow;
  role: Role;
  base: string;
  onAction: (kind: AccountActionKind, ids: number[], defaultPrice?: number | null) => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const isAdmin = role === "ADMIN";
  const canEdit = isAdmin || row.status === "PENDING";
  const canDelete = isAdmin || row.status === "PENDING";
  const can = (action: keyof typeof STATUS_ACTION_FROM) => STATUS_ACTION_FROM[action].includes(row.status);
  const btn = compact ? "icon-btn size-7" : "icon-btn";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(accountSummary(row));
      setCopied(true);
      toast.success("Copied account details", "Passwords are never included.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Link href={`${base}/accounts/${row.id}`} className={btn} aria-label={`View ${formatAccountId(row.id)}`} title="View">
        <Eye className="size-4" />
      </Link>
      {canEdit ? (
        <Link href={`${base}/accounts/${row.id}/edit`} className={btn} aria-label={`Edit ${formatAccountId(row.id)}`} title="Edit">
          <Pencil className="size-4" />
        </Link>
      ) : (
        <span className={`${btn} cursor-not-allowed opacity-30`} title="Only pending submissions can be edited" aria-hidden="true">
          <Pencil className="size-4" />
        </span>
      )}
      <button type="button" className={btn} onClick={copy} aria-label={`Copy ${formatAccountId(row.id)} details`} title="Copy">
        {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
      </button>
      {canDelete && (
        <button
          type="button"
          className={`${btn} hover:!text-rose-300`}
          onClick={() => onAction("DELETE", [row.id])}
          aria-label={`Delete ${formatAccountId(row.id)}`}
          title={isAdmin ? "Delete" : "Withdraw submission"}
        >
          <Trash2 className="size-4" />
        </button>
      )}
      {isAdmin && (
        <Menu
          label={`Actions for ${formatAccountId(row.id)}`}
          trigger={({ toggle, open }) => (
            <button type="button" className={btn} onClick={toggle} aria-expanded={open} aria-label={`More actions for ${formatAccountId(row.id)}`}>
              <Ellipsis className="size-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem tone="success" icon={<CircleCheck />} disabled={!can("APPROVE")} onSelect={() => (close(), onAction("APPROVE", [row.id]))}>
                Approve
              </MenuItem>
              <MenuItem icon={<CircleX />} disabled={!can("REJECT")} onSelect={() => (close(), onAction("REJECT", [row.id]))}>
                Reject
              </MenuItem>
              <MenuDivider />
              <MenuItem tone="warning" icon={<BadgeDollarSign />} disabled={!can("MARK_SOLD")} onSelect={() => (close(), onAction("MARK_SOLD", [row.id], row.asking_price))}>
                Mark Sold
              </MenuItem>
              <MenuItem icon={<Undo2 />} disabled={!can("MARK_UNSOLD")} onSelect={() => (close(), onAction("MARK_UNSOLD", [row.id]))}>
                Mark Unsold
              </MenuItem>
            </>
          )}
        </Menu>
      )}
    </div>
  );
}
