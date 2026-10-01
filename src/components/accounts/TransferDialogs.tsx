"use client";

import { Download, FileSpreadsheet, LoaderCircle, ShieldAlert, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { exportAccountsAction, importAccountsAction, type ImportResult } from "@/app/actions/accounts";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IMPORT_COLUMNS, IMPORT_TEMPLATE } from "@/lib/csv";

function downloadText(filename: string, text: string) {
  const blob = new Blob([`﻿${text}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportDialog({
  open,
  onClose,
  ids,
  filters,
}: {
  open: boolean;
  onClose: () => void;
  ids?: number[];
  filters?: Record<string, string>;
}) {
  const [includePasswords, setIncludePasswords] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const scope = ids && ids.length > 0 ? `${ids.length} selected account${ids.length === 1 ? "" : "s"}` : "all accounts matching the current filters";

  const run = () =>
    startTransition(async () => {
      const result = await exportAccountsAction({ ids, filters, includePasswords });
      if (!result.ok || !result.data) {
        toast.error("Export failed", result.ok ? undefined : result.error);
        return;
      }
      downloadText(result.data.filename, result.data.csv);
      toast.success(result.message ?? "Export ready");
      setIncludePasswords(false);
      onClose();
    });

  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onClose}
      title="Export accounts"
      description={<>Download {scope} as CSV.</>}
      icon={
        <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-poke-sky/15 text-poke-sky ring-1 ring-poke-sky/30">
          <Download className="size-5" />
        </span>
      }
    >
      <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${includePasswords ? "border-rose-400/40 bg-rose-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}>
        <input
          type="checkbox"
          checked={includePasswords}
          onChange={(event) => setIncludePasswords(event.target.checked)}
          className="mt-0.5 size-4 accent-rose-500"
        />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <ShieldAlert className="size-4 text-rose-300" /> Include decrypted passwords
          </span>
          <span className="mt-1 block text-xs text-slate-400">
            The file will contain plaintext credentials. The export is recorded in the activity log. Store the file securely and delete it when done.
          </span>
        </span>
      </label>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button type="button" className={`btn ${includePasswords ? "btn-danger" : "btn-primary"}`} onClick={run} disabled={pending} data-autofocus>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
          {includePasswords ? "Export with passwords" : "Export CSV"}
        </button>
      </div>
    </Modal>
  );
}

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();

  const close = () => {
    if (pending) return;
    setResult(null);
    setFileName(null);
    formRef.current?.reset();
    onClose();
  };

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const response = await importAccountsAction(formData);
      if (!response.ok) {
        toast.error("Import failed", response.error);
        return;
      }
      setResult(response.data ?? null);
      if ((response.data?.inserted ?? 0) > 0) toast.success(response.message ?? "Import complete");
      else toast.error(response.message ?? "Nothing imported");
    });

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import accounts"
      size="lg"
      description="Upload a CSV file. Passwords are encrypted on the server before they are stored."
      icon={
        <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-poke-yellow/15 text-poke-yellow ring-1 ring-poke-yellow/30">
          <Upload className="size-5" />
        </span>
      }
    >
      <form ref={formRef} action={submit} className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] px-6 py-8 text-center transition hover:border-poke-yellow/50 hover:bg-poke-yellow/5">
          <FileSpreadsheet className="size-8 text-poke-yellow" />
          <span className="text-sm font-semibold text-white">{fileName ?? "Choose a CSV file"}</span>
          <span className="text-xs text-slate-400">Max 1 MB · up to 1000 rows</span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="sr-only"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          />
        </label>

        <div className="rounded-xl border border-white/10 bg-navy-950/50 p-3 text-xs text-slate-400">
          <p>
            Columns: <code className="text-slate-200">{IMPORT_COLUMNS.join(", ")}</code>. Type accepts NEW, BOT or OLD.
          </p>
          <button
            type="button"
            className="mt-1.5 font-semibold text-poke-sky hover:text-white"
            onClick={() => downloadText("go-accounts-import-template.csv", IMPORT_TEMPLATE)}
          >
            Download template
          </button>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-300">
          <input type="checkbox" name="approve" className="size-4 accent-yellow-400" />
          Approve imported accounts immediately (status Unsold)
        </label>

        {result && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-white">
              {result.inserted} imported · {result.failed} skipped
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-rose-200 scrollbar-thin">
                {result.errors.map((err, i) => (
                  <li key={i}>
                    Row {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost" onClick={close} disabled={pending}>
            {result ? "Done" : "Cancel"}
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Import
          </button>
        </div>
      </form>
    </Modal>
  );
}
