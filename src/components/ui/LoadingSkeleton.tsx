import { CaptureBall } from "@/components/art/CaptureBall";

/** Capture-ball "catch" wobble used for page-level loading. */
export function PokeballLoader({ label = "Loading…", size = 64 }: { label?: string; size?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
      <div className="relative">
        <span className="absolute inset-0 rounded-full bg-poke-yellow/25 animate-pulse-ring" />
        <div className="animate-wobble" style={{ transformOrigin: "50% 90%" }}>
          <CaptureBall size={size} />
        </div>
        <div className="mx-auto mt-1 h-2 w-3/4 rounded-full bg-black/40 blur-[2px]" />
      </div>
      <p className="font-display text-sm tracking-wide text-slate-300">{label}</p>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function StatsSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card p-4">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="mt-4 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, columns = 7 }: { rows?: number; columns?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-4 border-b border-white/5 px-5 py-4">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-white/5 px-5 py-4 last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? "max-w-14" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="card relative h-56 overflow-hidden p-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-5 h-9 w-80 max-w-full" />
      <Skeleton className="mt-3 h-4 w-64 max-w-full" />
      <div className="mt-6 flex gap-3">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="card flex items-center gap-5 p-6">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="card space-y-4 p-6">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 4 }, (_, k) => (
              <Skeleton key={k} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({ hero = true, stats = true }: { hero?: boolean; stats?: boolean }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Loading</span>
      {hero && <HeroSkeleton />}
      {stats && <StatsSkeleton />}
      <div className="card flex flex-wrap gap-3 p-4">
        <Skeleton className="h-10 flex-1 min-w-48" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>
      <TableSkeleton />
    </div>
  );
}
