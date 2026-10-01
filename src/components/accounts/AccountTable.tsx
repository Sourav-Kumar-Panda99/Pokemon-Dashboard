"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, BadgeDollarSign, CircleCheck, CircleX, Download, Shapes, Trash2, Undo2, X } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { changeTypeAction } from "@/app/actions/accounts";
import { Avatar } from "@/components/ui/Avatar";
import { AccountStatusBadge, AccountTypeBadge } from "@/components/ui/Badges";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { ACCOUNT_TYPES, STATUS_ACTION_FROM, TYPE_META } from "@/lib/constants";
import { formatAccountId, formatCurrency, formatDate, formatRelative } from "@/lib/format";
import type { AccountRow, AccountType, Role, StatusAction } from "@/lib/types";
import { AccountRowActions } from "./AccountRowActions";
import { CredentialReveal } from "./CredentialReveal";
import { ExportDialog } from "./TransferDialogs";
import { useAccountActions } from "./useAccountActions";

// Opaque backgrounds for sticky columns (match the translucent card + row states).
const STICKY_HEAD = "sticky z-[2] bg-[#0d1935]";
const EDGE_LEFT = "shadow-[10px_0_14px_-12px_rgba(0,0,0,0.9)]";
const EDGE_RIGHT = "shadow-[-10px_0_14px_-12px_rgba(0,0,0,0.9)]";

function SortHeader({ column, children, className = "" }: { column: string; children: ReactNode; className?: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const sort = search.get("sort") ?? "created_at";
  const dir = search.get("dir") ?? "desc";
  const active = sort === column;
  const params = new URLSearchParams(search.toString());
  params.set("sort", column);
  params.set("dir", active && dir === "asc" ? "desc" : "asc");
  params.delete("page");
  return (
    <th scope="col" className={`px-2.5 py-3 whitespace-nowrap ${className}`} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link href={`${pathname}?${params.toString()}`} scroll={false} className={`inline-flex items-center gap-1 transition hover:text-white ${active ? "text-poke-yellow" : ""}`}>
        {children}
        {active ? dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
      </Link>
    </th>
  );
}

function Submitter({ row }: { row: AccountRow }) {
  if (!row.submitter_id) return <span className="text-slate-500">Deleted user</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={row.submitter_name} seed={row.submitter_id} size="xs" />
      <span className="truncate">{row.submitter_name || row.submitter_email}</span>
    </span>
  );
}

export function AccountTable({
  rows,
  role,
  base,
  emptyState,
  showSale = false,
}: {
  rows: AccountRow[];
  role: Role;
  base: "/admin" | "/dashboard";
  emptyState?: ReactNode;
  showSale?: boolean;
}) {
  const isAdmin = role === "ADMIN";
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [typePending, startTypeTransition] = useTransition();
  const toast = useToast();
  const { request, dialog } = useAccountActions({ onDone: () => setSelected(new Set()) });

  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = selectedRows.length > 0;

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visibleIds));

  const eligible = (action: StatusAction) => selectedRows.filter((r) => STATUS_ACTION_FROM[action].includes(r.status)).map((r) => r.id);

  const changeType = (type: AccountType) =>
    startTypeTransition(async () => {
      const result = await changeTypeAction([...selected], type);
      if (result.ok) {
        toast.success(result.message ?? "Type updated");
        setSelected(new Set());
      } else toast.error("Could not change type", result.error);
    });

  if (rows.length === 0) return <div className="card">{emptyState}</div>;

  const tableVisibility = isAdmin ? "hidden lg:block" : "hidden md:block";
  const cardVisibility = isAdmin ? "lg:hidden" : "md:hidden";

  return (
    <>
      {/* desktop / tablet table */}
      <div className={`card overflow-hidden ${tableVisibility}`}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-white/[0.07] bg-white/[0.02] text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              <tr>
                {isAdmin && (
                  <th scope="col" className={`w-10 py-3 pr-1 pl-4 ${STICKY_HEAD} left-0`}>
                    <input type="checkbox" className="size-4 accent-yellow-400" checked={allSelected} onChange={toggleAll} aria-label="Select all accounts on this page" />
                  </th>
                )}
                <SortHeader column="id" className={isAdmin ? `${STICKY_HEAD} left-10 ${EDGE_LEFT}` : "pl-5"}>Account ID</SortHeader>
                {isAdmin ? (
                  <>
                    <SortHeader column="login_email">ID Login Mail</SortHeader>
                    <th scope="col" className="px-2.5 py-3 whitespace-nowrap">Password</th>
                    <th scope="col" className="px-2.5 py-3 whitespace-nowrap">PTC Login</th>
                    <th scope="col" className="px-2.5 py-3 whitespace-nowrap">PTC Pass</th>
                  </>
                ) : (
                  <SortHeader column="login_email">Login Mail</SortHeader>
                )}
                <SortHeader column="type">Type</SortHeader>
                <SortHeader column="status">Status</SortHeader>
                {isAdmin && <SortHeader column="submitter">Submitted By</SortHeader>}
                {showSale ? <SortHeader column="sold_at">Sold On</SortHeader> : <SortHeader column="created_at">{isAdmin ? "Added On" : "Submitted"}</SortHeader>}
                {showSale && <th scope="col" className="px-2.5 py-3 text-right">Price</th>}
                {!isAdmin && <SortHeader column="updated_at">Updated</SortHeader>}
                <th scope="col" className={`px-3 py-3 text-right ${isAdmin ? `${STICKY_HEAD} right-0 ${EDGE_RIGHT}` : ""}`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((row) => {
                const isSelected = selected.has(row.id);
                const sticky = isAdmin ? `sticky z-[1] ${isSelected ? "bg-[#171f2e]" : "bg-[#081431] group-hover:bg-[#0f1b37]"}` : "";
                return (
                  <tr key={row.id} className={`group transition-colors ${isSelected ? "bg-poke-yellow/[0.06]" : "hover:bg-white/[0.03]"}`}>
                    {isAdmin && (
                      <td className={`py-3 pr-1 pl-4 ${sticky} left-0`}>
                        <input
                          type="checkbox"
                          className="size-4 accent-yellow-400"
                          checked={isSelected}
                          onChange={() => toggle(row.id)}
                          aria-label={`Select ${formatAccountId(row.id)}`}
                        />
                      </td>
                    )}
                    <td className={`px-2.5 py-3 ${isAdmin ? `${sticky} left-10 ${EDGE_LEFT}` : "pl-5"}`}>
                      <Link href={`${base}/accounts/${row.id}`} className="inline-flex items-center gap-2 font-mono text-[13px] font-semibold text-white hover:text-poke-yellow">
                        <span className={`size-2 rounded-full ${TYPE_META[row.type].dot}`} />
                        {formatAccountId(row.id)}
                      </Link>
                    </td>
                    <td className="max-w-[220px] px-3 py-3">
                      <span className="block truncate text-slate-200" title={row.login_email}>
                        {row.login_email}
                      </span>
                    </td>
                    {isAdmin && (
                      <>
                        <td className="px-2.5 py-3">
                          <CredentialReveal accountId={row.id} field="login_password" canReveal />
                        </td>
                        <td className="max-w-[160px] px-3 py-3">
                          {row.ptc_login ? <span className="block truncate font-mono text-[13px] text-slate-300">{row.ptc_login}</span> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-2.5 py-3">
                          <CredentialReveal accountId={row.id} field="ptc_password" canReveal present={Boolean(row.ptc_login)} />
                        </td>
                      </>
                    )}
                    <td className="px-2.5 py-3">
                      <AccountTypeBadge type={row.type} />
                    </td>
                    <td className="px-2.5 py-3">
                      <AccountStatusBadge status={row.status} />
                    </td>
                    {isAdmin && (
                      <td className="max-w-[160px] px-3 py-3 text-slate-300">
                        <Submitter row={row} />
                      </td>
                    )}
                    <td className="px-2.5 py-3 whitespace-nowrap text-slate-400">{formatDate(showSale ? row.sold_at : row.created_at)}</td>
                    {showSale && <td className="px-2.5 py-3 text-right font-semibold whitespace-nowrap text-emerald-300 tabular-nums">{formatCurrency(row.sale_price)}</td>}
                    {!isAdmin && <td className="px-2.5 py-3 whitespace-nowrap text-slate-400">{formatRelative(row.updated_at)}</td>}
                    <td className={`px-3 py-2 ${isAdmin ? `${sticky} right-0 ${EDGE_RIGHT}` : ""}`}>
                      <AccountRowActions row={row} role={role} base={base} onAction={request} compact />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* mobile cards */}
      <div className={`space-y-3 ${cardVisibility}`}>
        {isAdmin && (
          <label className="flex items-center gap-2 px-1 text-xs font-semibold text-slate-400">
            <input type="checkbox" className="size-4 accent-yellow-400" checked={allSelected} onChange={toggleAll} />
            Select all on this page
          </label>
        )}
        {rows.map((row) => (
          <article key={row.id} className={`card relative overflow-hidden p-4 ${selected.has(row.id) ? "ring-1 ring-poke-yellow/50" : ""}`}>
            <span className={`absolute inset-y-0 left-0 w-1 ${TYPE_META[row.type].dot}`} />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {isAdmin && (
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-yellow-400"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                    aria-label={`Select ${formatAccountId(row.id)}`}
                  />
                )}
                <div className="min-w-0">
                  <Link href={`${base}/accounts/${row.id}`} className="font-mono text-sm font-bold text-white">
                    {formatAccountId(row.id)}
                  </Link>
                  <p className="truncate text-sm text-slate-300">{row.login_email}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <AccountTypeBadge type={row.type} />
                <AccountStatusBadge status={row.status} />
              </div>
            </div>
            {isAdmin && (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-navy-950/40 p-3 text-xs">
                <div className="min-w-0">
                  <dt className="text-slate-500">Password</dt>
                  <dd><CredentialReveal accountId={row.id} field="login_password" canReveal /></dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-500">PTC Login</dt>
                  <dd className="truncate font-mono text-slate-300">{row.ptc_login ?? "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-500">PTC Pass</dt>
                  <dd><CredentialReveal accountId={row.id} field="ptc_password" canReveal present={Boolean(row.ptc_login)} /></dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-slate-500">Submitted By</dt>
                  <dd className="truncate text-slate-300">{row.submitter_name ?? "—"}</dd>
                </div>
              </dl>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {showSale ? `Sold ${formatDate(row.sold_at)} · ${formatCurrency(row.sale_price)}` : `Added ${formatDate(row.created_at)}`}
              </p>
              <AccountRowActions row={row} role={role} base={base} onAction={request} />
            </div>
          </article>
        ))}
      </div>

      {/* bulk actions */}
      {isAdmin && someSelected && (
        <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-4xl animate-fade-up md:left-[92px] lg:left-[284px]">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-poke-yellow/30 bg-navy-800/95 p-2.5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] backdrop-blur">
            <span className="flex items-center gap-2 px-2 text-sm font-semibold text-white">
              <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-poke-yellow px-2 py-0.5 text-xs font-bold text-navy-950">{selectedRows.length}</span>
              selected
            </span>
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              <button type="button" className="btn btn-sm btn-ghost" disabled={eligible("APPROVE").length === 0} onClick={() => request("APPROVE", eligible("APPROVE"))}>
                <CircleCheck className="size-3.5 text-emerald-300" /> Approve
              </button>
              <button type="button" className="btn btn-sm btn-ghost" disabled={eligible("REJECT").length === 0} onClick={() => request("REJECT", eligible("REJECT"))}>
                <CircleX className="size-3.5" /> Reject
              </button>
              <button type="button" className="btn btn-sm btn-ghost" disabled={eligible("MARK_SOLD").length === 0} onClick={() => request("MARK_SOLD", eligible("MARK_SOLD"))}>
                <BadgeDollarSign className="size-3.5 text-rose-300" /> Mark Sold
              </button>
              <button type="button" className="btn btn-sm btn-ghost" disabled={eligible("MARK_UNSOLD").length === 0} onClick={() => request("MARK_UNSOLD", eligible("MARK_UNSOLD"))}>
                <Undo2 className="size-3.5 text-emerald-300" /> Mark Unsold
              </button>
              <Menu
                align="left"
                panelClassName="w-44"
                label="Change type"
                trigger={({ toggle, open }) => (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={toggle} aria-expanded={open} disabled={typePending}>
                    <Shapes className="size-3.5 text-violet-300" /> Type
                  </button>
                )}
              >
                {(close) =>
                  ACCOUNT_TYPES.map((type) => (
                    <MenuItem key={type} onSelect={() => (close(), changeType(type))} icon={<span className={`block size-2 rounded-full ${TYPE_META[type].dot}`} />}>
                      {TYPE_META[type].label}
                    </MenuItem>
                  ))
                }
              </Menu>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setExportOpen(true)}>
                <Download className="size-3.5 text-sky-300" /> Export
              </button>
              <button type="button" className="btn btn-sm btn-ghost text-rose-300" onClick={() => request("DELETE", selectedRows.map((r) => r.id))}>
                <Trash2 className="size-3.5" /> Delete
              </button>
            </div>
            <button type="button" className="icon-btn" onClick={() => setSelected(new Set())} aria-label="Clear selection">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {dialog}
      {isAdmin && <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} ids={selectedRows.map((r) => r.id)} />}
    </>
  );
}
