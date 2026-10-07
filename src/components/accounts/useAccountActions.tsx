"use client";

import { useState, useTransition } from "react";
import { approveSalesAction, changeStatusAction, deleteAccountsAction } from "@/app/actions/accounts";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { formatAccountId, formatCurrency } from "@/lib/format";
import type { Role, StatusAction } from "@/lib/types";

/** APPROVE_SALE: an admin approves a sale that a supplier recorded. */
export type AccountActionKind = StatusAction | "DELETE" | "APPROVE_SALE";

interface Pending {
  kind: AccountActionKind;
  ids: number[];
  /** Submitter's asking price, shown in the Mark Sold sale details. */
  askingPrice: number | null;
}

function copyFor(kind: AccountActionKind, ids: number[], isAdmin: boolean) {
  const one = ids.length === 1;
  const subject = one ? `account ${formatAccountId(ids[0])}` : `${ids.length} accounts`;
  switch (kind) {
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
        description: isAdmin
          ? "Record the price you sold it for. The sale date is saved now and the submitter is notified."
          : "Record the price you sold it for. The sale is saved now and an admin will approve it for the records. You cannot edit the account afterwards.",
        confirm: "Confirm Sale",
        tone: "primary" as const,
      };
    case "APPROVE_SALE":
      return {
        title: one ? "Approve this sale?" : `Approve ${ids.length} sales?`,
        description: `Confirms ${one ? "the sale" : "the sales"} recorded by the supplier for your records. Price and sale date stay as recorded, and the supplier is notified.`,
        confirm: one ? "Approve Sale" : "Approve Sales",
        tone: "success" as const,
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
export function useAccountActions(options: { role?: Role; onDone?: (kind: AccountActionKind, ids: number[]) => void } = {}) {
  const isAdmin = (options.role ?? "ADMIN") === "ADMIN";
  const [current, setCurrent] = useState<Pending | null>(null);
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const priceValue = price.trim() === "" ? null : Number(price);
  const priceInvalid = priceValue !== null && (!Number.isFinite(priceValue) || priceValue < 0 || priceValue > 1_000_000);
  // A sold price is required when marking accounts as sold.
  const priceMissing = priceValue === null;
  const difference = current?.askingPrice !== null && current?.askingPrice !== undefined && priceValue !== null && !priceInvalid ? priceValue - current.askingPrice : null;

  const run = (kind: AccountActionKind, ids: number[]) =>
    startTransition(async () => {
      const result =
        kind === "DELETE"
          ? await deleteAccountsAction(ids)
          : kind === "APPROVE_SALE"
            ? await approveSalesAction(ids)
            : await changeStatusAction({ ids, action: kind, price: kind === "MARK_SOLD" ? priceValue : null, reason: kind === "REJECT" ? reason : undefined });
      if (result.ok) {
        toast.success(result.message ?? "Done");
        setCurrent(null);
        options.onDone?.(kind, ids);
      } else {
        toast.error("Action failed", result.error);
      }
    });

  /** `askingPrice` is shown in the sale details and pre-fills the sold price. */
  const request = (kind: AccountActionKind, ids: number[], askingPrice?: number | null) => {
    if (ids.length === 0) return;
    // Approving one sale changes nothing but the approval stamp: no dialog needed.
    if (kind === "APPROVE_SALE" && ids.length === 1) {
      run(kind, ids);
      return;
    }
    const asking = askingPrice ?? null;
    setPrice(kind === "MARK_SOLD" && asking !== null ? String(asking) : "");
    setReason("");
    setCurrent({ kind, ids, askingPrice: asking });
  };

  const confirm = () => {
    if (current) run(current.kind, current.ids);
  };

  const copy = current ? copyFor(current.kind, current.ids, isAdmin) : null;

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
      confirmDisabled={current?.kind === "MARK_SOLD" && (priceInvalid || priceMissing)}
    >
      {current?.kind === "MARK_SOLD" && (
        <div className="rounded-2xl border border-poke-yellow/25 bg-poke-yellow/[0.05] p-4">
          <p className="text-[11px] font-bold tracking-[0.16em] text-poke-yellow uppercase">Sale details</p>
          {current.askingPrice !== null && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-400">{isAdmin ? "Submitter asked" : "Your asking price"}</span>
              <span className="font-semibold text-sky-200 tabular-nums">{formatCurrency(current.askingPrice)}</span>
            </div>
          )}
          <label htmlFor="sale-price" className="label mt-3">
            Sold for {current.ids.length > 1 ? "(each)" : ""}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold text-slate-400">$</span>
            <input
              id="sale-price"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="input pl-7 text-base font-semibold tabular-nums"
              placeholder="0.00"
              aria-invalid={priceInvalid}
              data-autofocus
            />
          </div>
          {priceInvalid && <p className="mt-1.5 text-xs text-rose-300">Enter a valid price.</p>}
          {difference !== null && (
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3 text-sm">
              <span className="text-slate-400">Difference vs asking</span>
              <span className={`font-semibold tabular-nums ${difference >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {difference >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(difference))}
              </span>
            </div>
          )}
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
