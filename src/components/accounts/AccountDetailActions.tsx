"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeDollarSign, CircleCheck, CircleX, Copy, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { STATUS_ACTION_FROM, saleAwaitingApproval } from "@/lib/constants";
import type { AccountRow, Role } from "@/lib/types";
import { accountSummary } from "./AccountRowActions";
import { useAccountActions } from "./useAccountActions";

export function AccountDetailActions({
  account,
  role,
  base,
}: {
  account: Pick<AccountRow, "id" | "login_email" | "ptc_login" | "type" | "status" | "asking_price" | "approved_at">;
  role: Role;
  base: "/admin" | "/dashboard";
}) {
  const router = useRouter();
  const toast = useToast();
  const { request, dialog } = useAccountActions({
    role,
    onDone: (kind) => {
      if (kind === "DELETE") router.push(base === "/admin" ? "/admin/accounts" : "/dashboard");
    },
  });
  const isAdmin = role === "ADMIN";
  // Suppliers only ever see their own accounts here, and may sell them while they are in stock.
  const can = (action: keyof typeof STATUS_ACTION_FROM) => (isAdmin || action === "MARK_SOLD") && STATUS_ACTION_FROM[action].includes(account.status);
  const canApprove = isAdmin && saleAwaitingApproval(account);
  const editable = isAdmin || account.status === "PENDING";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(accountSummary(account));
      toast.success("Copied account details", "Passwords are never included.");
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {can("MARK_SOLD") && (
        <button type="button" className="btn btn-primary" onClick={() => request("MARK_SOLD", [account.id], account.asking_price)}>
          <BadgeDollarSign className="size-4" /> Mark Sold
        </button>
      )}
      {canApprove && (
        <button type="button" className="btn btn-success" onClick={() => request("APPROVE_SALE", [account.id])}>
          <CircleCheck className="size-4" /> Approve Sale
        </button>
      )}
      {can("REJECT") && (
        <button type="button" className="btn btn-ghost" onClick={() => request("REJECT", [account.id])}>
          <CircleX className="size-4" /> Reject
        </button>
      )}
      {editable && (
        <Link href={`${base}/accounts/${account.id}/edit`} className="btn btn-ghost">
          <Pencil className="size-4" /> Edit
        </Link>
      )}
      <button type="button" className="btn btn-ghost" onClick={copy}>
        <Copy className="size-4" /> Copy
      </button>
      {editable && (
        <button type="button" className="btn btn-ghost text-rose-300 hover:border-rose-400/40" onClick={() => request("DELETE", [account.id])}>
          <Trash2 className="size-4" /> {isAdmin ? "Delete" : "Withdraw"}
        </button>
      )}
      {dialog}
    </div>
  );
}
