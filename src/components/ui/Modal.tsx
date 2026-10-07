"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  icon,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
  dismissible?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
      );
    (panel?.querySelector<HTMLElement>("[data-autofocus]") ?? focusable()[0])?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) onClose();
      if (event.key === "Tab") {
        const items = focusable();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose, dismissible]);

  if (!open || typeof document === "undefined") return null;
  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-navy-950/75 backdrop-blur-sm animate-fade-up" onClick={dismissible ? onClose : undefined} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${widths[size]} max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-b from-navy-800 to-navy-900 p-6 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] animate-fade-up scrollbar-thin`}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-poke-yellow/60 to-transparent" />
        {dismissible && (
          <button type="button" onClick={onClose} className="icon-btn absolute top-4 right-4" aria-label="Close dialog">
            <X className="size-4" />
          </button>
        )}
        <div className="flex items-start gap-4 pr-8">
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="min-w-0">
            <h2 id="modal-title" className="font-display text-xl font-semibold text-white">
              {title}
            </h2>
            {description && <div className="mt-1.5 text-sm text-slate-400">{description}</div>}
          </div>
        </div>
        {children && <div className="mt-5">{children}</div>}
      </div>
    </div>,
    document.body,
  );
}
