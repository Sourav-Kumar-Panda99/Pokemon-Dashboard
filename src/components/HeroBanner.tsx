import type { ReactNode } from "react";
import { HeroScene } from "@/components/art/HeroScene";

/** Cinematic dashboard banner: copy on the left, isometric map art on the right. */
export function HeroBanner({
  eyebrow,
  title,
  subtitle,
  actions,
  chips,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle: ReactNode;
  actions?: ReactNode;
  chips?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#123a9a] via-[#0c2463] to-[#071535] shadow-[0_30px_80px_-30px_rgba(16,64,190,0.65)] animate-fade-up">
      <div className="map-grid pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(90deg,transparent,black_30%,black)]" />
      <div className="pointer-events-none absolute -top-24 -left-24 size-80 rounded-full bg-poke-yellow/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 -bottom-32 size-96 rounded-full bg-poke-sky/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-poke-yellow/70 to-transparent" />

      <div className="relative grid items-center gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-10">
          {eyebrow && (
            <p className="inline-flex items-center gap-2 rounded-full border border-poke-yellow/30 bg-poke-yellow/10 px-3 py-1 text-[11px] font-bold tracking-[0.2em] text-poke-yellow uppercase">
              <span className="size-1.5 animate-pulse rounded-full bg-poke-yellow" />
              {eyebrow}
            </p>
          )}
          <h1 className="mt-4 font-display text-3xl leading-[1.08] font-semibold text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.4)] sm:text-4xl xl:text-[44px]">
            {title}
          </h1>
          <p className="mt-3 max-w-lg text-base text-blue-100/80">{subtitle}</p>
          {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
          {chips && <div className="mt-6 flex flex-wrap gap-2">{chips}</div>}
        </div>
        <div className="relative -mt-6 h-56 sm:h-72 lg:mt-0 lg:h-full lg:min-h-[300px]">
          <HeroScene className="absolute inset-0 h-full w-full" />
        </div>
      </div>
    </section>
  );
}

export function HeroChip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "yellow" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur ${
        tone === "yellow" ? "border-poke-yellow/40 bg-poke-yellow/15 text-yellow-100" : "border-white/15 bg-white/[0.07] text-blue-50"
      }`}
    >
      {children}
    </span>
  );
}
