"use client";

import Link from "next/link";
import { CalendarDays, CircleCheck, CircleX, Pencil, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { CaptureBall } from "@/components/art/CaptureBall";
import { Avatar } from "@/components/ui/Avatar";
import { AccountTypeBadge } from "@/components/ui/Badges";
import { formatAccountId, formatCurrency, formatDateTime, formatRelative } from "@/lib/format";
import type { AccountRow } from "@/lib/types";
import { useAccountActions } from "./useAccountActions";

/** Review queue: one card per pending submission, with bulk approve. */
export function PendingReview({ rows }: { rows: AccountRow[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { request, dialog } = useAccountActions({ onDone: () => setSelected(new Set()) });
  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const ids = [...selected].filter((id) => rows.some((r) => r.id === id));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <input
            type="checkbox"
            className="size-4 accent-yellow-400"
            checked={rows.length > 0 && ids.length === rows.length}
            onChange={() => setSelected(ids.length === rows.length ? new Set() : new Set(rows.map((r) => r.id)))}
          />
          Select all on this page
        </label>
        <div className="flex gap-2">
          <button type="button" className="btn btn-success btn-sm" disabled={ids.length === 0} onClick={() => request("APPROVE", ids)}>
            <CircleCheck className="size-4" /> Approve {ids.length > 0 ? ids.length : ""}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={ids.length === 0} onClick={() => request("REJECT", ids)}>
            <CircleX className="size-4" /> Reject
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {rows.map((row, index) => {
          const isSelected = selected.has(row.id);
          return (
            <article
              key={row.id}
              className={`card card-hover relative overflow-hidden animate-fade-up ${isSelected ? "ring-1 ring-poke-yellow/60" : ""}`}
              style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            >
              <div className="relative flex items-center justify-between gap-3 border-b border-white/[0.06] bg-gradient-to-r from-poke-red/20 via-transparent to-transparent px-5 py-3">
                <label className="flex items-center gap-3">
                  <input type="checkbox" className="size-4 accent-yellow-400" checked={isSelected} onChange={() => toggle(row.id)} aria-label={`Select ${formatAccountId(row.id)}`} />
                  <CaptureBall size={26} />
                  <span className="font-mono text-base font-bold text-white">{formatAccountId(row.id)}</span>
                </label>
                <AccountTypeBadge type={row.type} />
              </div>
              <dl className="space-y-2.5 px-5 py-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Login Mail</dt>
                  <dd className="truncate text-right text-slate-200">{row.login_email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">PTC Login</dt>
                  <dd className="truncate text-right font-mono text-slate-300">{row.ptc_login ?? "—"}</dd>
                </div>
                {row.asking_price !== null && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Asking Price</dt>
                    <dd className="font-semibold text-sky-200 tabular-nums">{formatCurrency(row.asking_price)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-slate-500">
                    <UserRound className="size-3.5" /> Submitted By
                  </dt>
                  <dd className="flex min-w-0 items-center gap-2 text-slate-200">
                    <Avatar name={row.submitter_name} seed={row.submitter_id} size="xs" />
                    <span className="truncate">{row.submitter_name ?? "—"}</span>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-slate-500">
                    <CalendarDays className="size-3.5" /> Submitted
                  </dt>
                  <dd className="text-right text-slate-300" title={formatDateTime(row.created_at)}>
                    {formatRelative(row.created_at)}
                  </dd>
                </div>
                {row.notes && <p className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-400">{row.notes}</p>}
              </dl>
              <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-5 py-3">
                <button type="button" className="btn btn-success btn-sm flex-1" onClick={() => request("APPROVE", [row.id])}>
                  <CircleCheck className="size-4" /> Approve
                </button>
                <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={() => request("REJECT", [row.id])}>
                  <CircleX className="size-4" /> Reject
                </button>
                <Link href={`/admin/accounts/${row.id}/edit`} className="icon-btn" aria-label={`Edit ${formatAccountId(row.id)}`} title="Edit">
                  <Pencil className="size-4" />
                </Link>
                <button type="button" className="icon-btn hover:!text-rose-300" onClick={() => request("DELETE", [row.id])} aria-label={`Delete ${formatAccountId(row.id)}`} title="Delete">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {dialog}
    </>
  );
}
