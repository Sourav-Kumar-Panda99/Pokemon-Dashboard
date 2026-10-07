"use client";

import { LoaderCircle, TriangleAlert, CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { Modal } from "./Modal";

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  pending = false,
  children,
  confirmDisabled = false,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger" | "success" | "blue";
  pending?: boolean;
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  const danger = tone === "danger";
  const buttonClass = { primary: "btn-primary", danger: "btn-danger", success: "btn-success", blue: "btn-blue" }[tone];
  return (
    <Modal
      open={open}
      onClose={pending ? () => {} : onCancel}
      title={title}
      description={description}
      size="sm"
      dismissible={!pending}
      icon={
        <span
          className={`inline-flex size-11 items-center justify-center rounded-2xl ring-1 ${
            danger ? "bg-red-500/15 text-red-300 ring-red-400/30" : "bg-poke-yellow/15 text-poke-yellow ring-poke-yellow/30"
          }`}
        >
          {danger ? <TriangleAlert className="size-5" /> : <CircleHelp className="size-5" />}
        </span>
      }
    >
      {children}
      <div className={`flex flex-col-reverse gap-2 sm:flex-row sm:justify-end ${children ? "mt-5" : ""}`}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </button>
        <button type="button" className={`btn ${buttonClass}`} onClick={onConfirm} disabled={pending || confirmDisabled} data-autofocus>
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
