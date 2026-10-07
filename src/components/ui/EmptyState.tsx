import type { ReactNode } from "react";
import { EmptyArt, type EmptyArtVariant } from "@/components/art/EmptyArt";

export function EmptyState({
  title,
  description,
  variant = "search",
  action,
  compact = false,
}: {
  title: string;
  description?: string;
  variant?: EmptyArtVariant;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-14"} px-6`}>
      <div className="relative">
        <div className="absolute inset-x-6 bottom-2 h-10 rounded-full bg-poke-sky/20 blur-2xl" />
        <EmptyArt variant={variant} className={`relative ${compact ? "w-44" : "w-64"} max-w-full`} />
      </div>
      <h3 className="mt-3 font-display text-xl font-semibold text-white">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
