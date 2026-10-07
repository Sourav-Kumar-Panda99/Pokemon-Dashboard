import type { ReactNode } from "react";
import { CaptureBall } from "@/components/art/CaptureBall";

export function AuthCard({ subtitle, children, footer }: { subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="glass relative w-full max-w-md rounded-[28px] p-7 animate-fade-up sm:p-9">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-poke-yellow/80 to-transparent" />
      <div className="pointer-events-none absolute -top-24 left-1/2 size-48 -translate-x-1/2 rounded-full bg-poke-yellow/20 blur-3xl" />
      <div className="relative flex flex-col items-center text-center">
        <div className="relative -mt-16 mb-4 sm:-mt-20">
          <span className="absolute inset-0 rounded-full bg-poke-yellow/30 blur-xl" />
          <div className="animate-float">
            <CaptureBall size={84} className="relative drop-shadow-[0_14px_24px_rgba(0,0,0,0.55)]" title="GO Account Manager" />
          </div>
        </div>
        <h1 className="font-display text-[28px] leading-none font-bold tracking-wide italic sm:text-[32px]">
          <span className="text-gradient-gold drop-shadow-[0_3px_0_rgba(23,59,140,0.95)]">GO</span>
          <span className="ml-2 text-white drop-shadow-[0_3px_0_rgba(23,59,140,0.95)]">ACCOUNT MANAGER</span>
        </h1>
        <p className="mt-2.5 text-sm font-semibold tracking-[0.18em] text-poke-sky uppercase">{subtitle}</p>
      </div>
      <div className="relative mt-7">{children}</div>
      {footer && <div className="relative mt-6 text-center text-sm text-slate-300">{footer}</div>}
    </div>
  );
}
