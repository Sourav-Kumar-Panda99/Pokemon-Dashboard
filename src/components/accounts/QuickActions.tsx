"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BadgeDollarSign, Download, Hourglass, Package, Plus, Upload, Users, Zap } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ExportDialog, ImportDialog } from "./TransferDialogs";

function Action({ href, onClick, icon, label, hint, accent }: { href?: string; onClick?: () => void; icon: ReactNode; label: string; hint?: string; accent: string }) {
  const body = (
    <>
      <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${accent} transition group-hover:scale-110`}>{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-semibold text-white">{label}</span>
        {hint && <span className="block truncate text-[11px] text-slate-400">{hint}</span>}
      </span>
    </>
  );
  const cls = "group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.05]";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

export function QuickActions({ pending, unsold, sold }: { pending: number; unsold: number; sold: number }) {
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const params = useSearchParams();
  const filters = Object.fromEntries([...params.entries()].filter(([key]) => ["q", "type", "status", "submitter", "from", "to", "sort", "dir"].includes(key)));

  return (
    <section className="card relative h-full overflow-hidden p-4">
      <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-poke-yellow/10 blur-2xl" />
      <h2 className="relative mb-3 flex items-center gap-2 font-display text-base font-semibold text-white">
        <Zap className="size-4 text-poke-yellow" /> Quick Actions
      </h2>
      <div className="relative grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <Action href="/admin/accounts/new" icon={<Plus className="size-4" strokeWidth={3} />} label="Add Account" hint="Add to inventory" accent="bg-poke-yellow text-navy-950" />
        <Action href="/admin/pending" icon={<Hourglass className="size-4" />} label="Review Pending" hint={`${pending} waiting`} accent="bg-yellow-400/15 text-yellow-300" />
        <Action href="/admin/accounts?status=UNSOLD" icon={<Package className="size-4" />} label="View Unsold" hint={`${unsold} available`} accent="bg-emerald-400/15 text-emerald-300" />
        <Action href="/admin/accounts?status=SOLD" icon={<BadgeDollarSign className="size-4" />} label="View Sold" hint={`${sold} sold`} accent="bg-rose-400/15 text-rose-300" />
        <Action href="/admin/users" icon={<Users className="size-4" />} label="Manage Users" hint="Roles & access" accent="bg-cyan-400/15 text-cyan-300" />
        <Action onClick={() => setExportOpen(true)} icon={<Download className="size-4" />} label="Export Accounts" hint="CSV download" accent="bg-sky-400/15 text-sky-300" />
        <Action onClick={() => setImportOpen(true)} icon={<Upload className="size-4" />} label="Import Accounts" hint="CSV upload" accent="bg-violet-400/15 text-violet-300" />
      </div>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} filters={filters} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </section>
  );
}

export function TransferButtons() {
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const params = useSearchParams();
  const filters = Object.fromEntries([...params.entries()].filter(([key]) => ["q", "type", "status", "submitter", "from", "to", "sort", "dir"].includes(key)));
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setImportOpen(true)}>
        <Upload className="size-4" /> Import
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => setExportOpen(true)}>
        <Download className="size-4" /> Export
      </button>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} filters={filters} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
