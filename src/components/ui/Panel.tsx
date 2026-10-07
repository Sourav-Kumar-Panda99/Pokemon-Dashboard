import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Panel({
  title,
  icon: Icon,
  actions,
  children,
  className = "",
  bodyClassName = "p-5",
  description,
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  description?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-poke-yellow/10 text-poke-yellow ring-1 ring-poke-yellow/25">
                <Icon className="size-4" />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-white">{title}</h2>
              {description && <p className="text-xs text-slate-400">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-4 animate-fade-up sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3.5">
        {Icon && (
          <span className="mt-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-poke-blue to-navy-600 text-white shadow-[0_10px_30px_-10px_rgba(47,123,255,0.8)] ring-1 ring-white/15">
            <Icon className="size-5" />
          </span>
        )}
        <div>
          {eyebrow && <p className="text-[11px] font-bold tracking-[0.18em] text-poke-yellow uppercase">{eyebrow}</p>}
          <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
