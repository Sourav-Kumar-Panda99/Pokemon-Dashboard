"use client";

import { useState, useTransition } from "react";
import { changeStatusAction, deleteAccountsAction } from "@/app/actions/accounts";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatAccountId } from "@/lib/format";
import type { StatusAction } from "@/lib/types";

export type AccountActionKind = StatusAction | "DELETE";

interface Pending {
  kind: AccountActionKind;
  ids: number[];
}

function copyFor(kind: AccountActionKind, ids: number[]) {
  const one = ids.length === 1;
  const subject = one ? `account ${formatAccountId(ids[0])}` : `${ids.length} accounts`;
  switch (kind) {
    case "APPROVE":
      return {
        title: one ? "Approve this account?" : `Approve ${ids.length} accounts?`,
        description: `${one ? "It" : "They"} will join the inventory as Unsold.`,
        confirm: "Approve",
        tone: "success" as const,
      };
    case "REJECT":
      return {
        title: one ? "Reject this account?" : `Reject ${ids.length} accounts?`,
        description: `The submitter will be notified that ${subject} did not pass review.`,
        confirm: "Reject",
        tone: "danger" as const,
      };
    case "MARK_SOLD":
      return {
        title: one ? "Mark this account as sold?" : `Mark ${ids.length} accounts as sold?`,
        description: "The sale date is recorded now and the submitter is notified.",
        confirm: "Confirm Sale",
        tone: "primary" as const,
      };
    case "MARK_UNSOLD":
      return {
        title: one ? "Mark this account as unsold?" : `Mark ${ids.length} accounts as unsold?`,
        description: "The sale is voided and the account returns to available inventory.",
        confirm: "Mark Unsold",
        tone: "blue" as const,
      };
    case "DELETE":
      return {
        title: one ? "Delete this account permanently?" : `Delete ${ids.length} accounts permanently?`,
        description: "This cannot be undone. Credentials are destroyed; the audit log keeps a record of the deletion.",
        confirm: "Delete",
        tone: "danger" as const,
      };
  }
}

/** Confirmation-guarded account mutations shared by tables, cards and detail pages. */
export function useAccountActions(options: { onDone?: (kind: AccountActionKind, ids: number[]) => void } = {}) {
  const [current, setCurrent] = useState<Pending | null>(null);
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  /** `defaultPrice` pre-fills the sale price (e.g. with the submitter's asking price). */
  const request = (kind: AccountActionKind, ids: number[], defaultPrice?: number | null) => {
    if (ids.length === 0) return;
    setPrice(kind === "MARK_SOLD" && defaultPrice !== null && defaultPrice !== undefined ? String(defaultPrice) : "");
    setReason("");
    setCurrent({ kind, ids });
  };

  const priceValue = price.trim() === "" ? null : Number(price);
  const priceInvalid = priceValue !== null && (!Number.isFinite(priceValue) || priceValue < 0 || priceValue > 1_000_000);

  const confirm = () => {
    if (!current) return;
    const { kind, ids } = current;
    startTransition(async () => {
      const result =
        kind === "DELETE"
          ? await deleteAccountsAction(ids)
          : await changeStatusAction({ ids, action: kind, price: kind === "MARK_SOLD" ? priceValue : null, reason: kind === "REJECT" ? reason : undefined });
      if (result.ok) {
        toast.success(result.message ?? "Done");
        setCurrent(null);
        options.onDone?.(kind, ids);
      } else {
        toast.error("Action failed", result.error);
      }
    });
  };

  const copy = current ? copyFor(current.kind, current.ids) : null;

  const dialog = (
    <ConfirmDialog
      open={current !== null}
      onCancel={() => setCurrent(null)}
      onConfirm={confirm}
      pending={pending}
      title={copy?.title}
      description={copy?.description}
      confirmLabel={copy?.confirm}
      tone={copy?.tone}
      confirmDisabled={current?.kind === "MARK_SOLD" && priceInvalid}
    >
      {current?.kind === "MARK_SOLD" && (
        <div>
          <label htmlFor="sale-price" className="label">
            Sale price (optional)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-slate-400">$</span>
            <input
              id="sale-price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="input pl-7"
              placeholder="0.00"
              aria-invalid={priceInvalid}
            />
          </div>
          {current.ids.length > 1 && <p className="mt-1.5 text-xs text-slate-500">Applied to each account.</p>}
        </div>
      )}
      {current?.kind === "REJECT" && (
        <div>
          <label htmlFor="reject-reason" className="label">
            Reason (shared with the submitter)
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            maxLength={300}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="input resize-none"
            placeholder="e.g. Login failed during review"
          />
        </div>
      )}
    </ConfirmDialog>
  );

  return { request, dialog, pending };
}
