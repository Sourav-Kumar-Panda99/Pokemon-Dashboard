"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeDollarSign, CircleCheck, CircleX, Copy, Pencil, Trash2, Undo2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { STATUS_ACTION_FROM } from "@/lib/constants";
import type { AccountRow, Role } from "@/lib/types";
import { accountSummary } from "./AccountRowActions";
import { useAccountActions } from "./useAccountActions";

export function AccountDetailActions({
  account,
  role,
  base,
}: {
  account: Pick<AccountRow, "id" | "login_email" | "ptc_login" | "type" | "status" | "asking_price">;
  role: Role;
  base: "/admin" | "/dashboard";
}) {
  const router = useRouter();
  const toast = useToast();
  const { request, dialog } = useAccountActions({
    onDone: (kind) => {
      if (kind === "DELETE") router.push(base === "/admin" ? "/admin/accounts" : "/dashboard");
    },
  });
  const isAdmin = role === "ADMIN";
  const can = (action: keyof typeof STATUS_ACTION_FROM) => isAdmin && STATUS_ACTION_FROM[action].includes(account.status);
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
      {can("APPROVE") && (
        <button type="button" className="btn btn-success" onClick={() => request("APPROVE", [account.id])}>
          <CircleCheck className="size-4" /> Approve
        </button>
      )}
      {can("MARK_SOLD") && (
        <button type="button" className="btn btn-primary" onClick={() => request("MARK_SOLD", [account.id], account.asking_price)}>
          <BadgeDollarSign className="size-4" /> Mark Sold
        </button>
      )}
      {can("MARK_UNSOLD") && (
        <button type="button" className="btn btn-blue" onClick={() => request("MARK_UNSOLD", [account.id])}>
          <Undo2 className="size-4" /> Mark Unsold
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
