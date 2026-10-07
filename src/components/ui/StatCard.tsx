import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/format";

export type StatTone = "yellow" | "blue" | "sky" | "violet" | "amber" | "emerald" | "rose" | "slate";

const TONES: Record<StatTone, { icon: string; ring: string; bar: string }> = {
  yellow: { icon: "from-yellow-300 to-amber-500 text-navy-950", ring: "group-hover:shadow-[0_0_40px_-12px_rgba(255,203,5,0.7)]", bar: "bg-yellow-400" },
  blue: { icon: "from-blue-400 to-blue-700 text-white", ring: "group-hover:shadow-[0_0_40px_-12px_rgba(47,123,255,0.7)]", bar: "bg-blue-400" },
  sky: { icon: "from-sky-300 to-sky-600 text-white", ring: "group-hover:shadow-[0_0_40px_-12px_rgba(56,189,248,0.7)]", bar: "bg-sky-400" },
  violet: { icon: "from-violet-400 to-purple-700 text-white", ring: "group-hover:shadow-[0_0_40px_-12px_rgba(167,139,250,0.7)]", bar: "bg-violet-400" },
  amber: { icon: "from-amber-300 to-orange-600 text-white", ring: "group-hover:shadow-[0_0_40px_-12px_rgba(251,146,60,0.7)]", bar: "bg-amber-400" },
  emerald: { icon: "from-emerald-300 to-green-600 text-white", ring: "group-hover:shadow-[0_0_40px_-12px_rgba(52,211,153,0.7)]", bar: "bg-emerald-400" },
  rose: { icon: "from-rose-400 to-red-600 text-white", ring: "group-hover:shadow-[0_0_40px_-12px_rgba(244,63,94,0.7)]", bar: "bg-rose-400" },
  slate: { icon: "from-slate-400 to-slate-600 text-white", ring: "group-hover:shadow-[0_0_40px_-12px_rgba(148,163,184,0.6)]", bar: "bg-slate-400" },
};

/** Pokédex-style stat tile. Optional `share` draws a progress bar (0–1). */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
  hint,
  share,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: StatTone;
  href?: string;
  hint?: string;
  share?: number;
}) {
  const t = TONES[tone];
  const body = (
    <div className={`group card card-hover relative h-full overflow-hidden p-4 ${t.ring}`}>
      <div className="pointer-events-none absolute -top-8 -right-8 size-24 rounded-full border-[10px] border-white/[0.04]" />
      <div className="pointer-events-none absolute -top-8 -right-8 size-24">
        <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 bg-white/[0.04]" />
      </div>
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ${t.icon}`}>
          <Icon className="size-5" strokeWidth={2.4} />
        </span>
        {hint && <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{hint}</span>}
      </div>
      <p className="mt-4 font-display text-3xl leading-none font-semibold text-white tabular-nums">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      <p className="mt-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">{label}</p>
      {share !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.round(Math.min(Math.max(share, 0), 1) * 100)}%` }} />
        </div>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-poke-yellow">
      {body}
    </Link>
  ) : (
    body
  );
}
