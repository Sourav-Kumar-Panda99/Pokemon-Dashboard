"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const PANEL_ESTIMATE = 280;

function placeBelowOrAbove(anchor: HTMLElement, align: "left" | "right"): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom;
  const up = below < PANEL_ESTIMATE && rect.top > below;
  return {
    position: "fixed",
    ...(up ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
    ...(align === "right" ? { right: Math.max(8, window.innerWidth - rect.right) } : { left: Math.max(8, rect.left) }),
  };
}

/**
 * Lightweight dropdown. The panel is portalled with fixed positioning so it is
 * never clipped by scrolling tables or covered by sticky columns; it opens
 * upward when there is no room below. Click-outside, Escape, scroll and arrow
 * keys are handled.
 */
export function Menu({
  trigger,
  children,
  align = "right",
  label,
  className = "",
  panelClassName = "w-56",
}: {
  trigger: (props: { open: boolean; toggle: (event: ReactMouseEvent<HTMLElement>) => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  label?: string;
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const toggle = (event: ReactMouseEvent<HTMLElement>) => {
    if (!open) {
      setAnchor(event.currentTarget);
      setStyle(placeBelowOrAbove(event.currentTarget, align));
    }
    setOpen((value) => !value);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
        if (items.length === 0) return;
        event.preventDefault();
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items[next].focus();
      }
    };
    // Keep the panel attached to its trigger while the page or a table scrolls.
    const follow = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node) || !anchor) return;
      setStyle(placeBelowOrAbove(anchor, align));
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open, align, anchor]);

  return (
    <div ref={triggerRef} className={`relative ${className}`}>
      {trigger({ open, toggle })}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={label}
            style={style}
            className={`z-[90] ${panelClassName} max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-navy-800/98 p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur animate-fade-up scrollbar-thin`}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function MenuItem({
  onSelect,
  icon,
  children,
  tone = "default",
  disabled = false,
}: {
  onSelect: () => void;
  icon?: ReactNode;
  children: ReactNode;
  tone?: "default" | "danger" | "success" | "warning";
  disabled?: boolean;
}) {
  const tones = {
    default: "text-slate-200 hover:bg-white/[0.07]",
    danger: "text-rose-300 hover:bg-rose-500/10",
    success: "text-emerald-300 hover:bg-emerald-500/10",
    warning: "text-yellow-200 hover:bg-yellow-400/10",
  };
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition outline-none focus-visible:bg-white/[0.08] disabled:opacity-40 ${tones[tone]}`}
    >
      {icon && <span className="shrink-0 [&>svg]:size-4">{icon}</span>}
      {children}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-white/[0.07]" />;
}
