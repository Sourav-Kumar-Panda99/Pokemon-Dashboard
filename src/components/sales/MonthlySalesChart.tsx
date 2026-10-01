"use client";

import { useState } from "react";
import { formatCurrency, formatMonth, formatNumber } from "@/lib/format";

interface Point {
  month: string;
  count: number;
  revenue: number;
}

function niceStep(max: number, ticks = 4) {
  const raw = Math.max(max, 1) / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/** Single-series column chart: accounts sold per month (last 12 months). */
export function MonthlySalesChart({ data }: { data: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.count), 0);
  const step = niceStep(max);
  const top = Math.max(step * Math.ceil(max / step), step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const peak = data.reduce((best, d, i) => (d.count > data[best].count ? i : best), 0);
  const last = data.length - 1;

  return (
    <figure>
      <div className="relative h-64 pl-9">
        {/* recessive hairline grid + y ticks */}
        {ticks.map((tick) => (
          <div key={tick} className="absolute right-0 left-9 border-t border-white/[0.07]" style={{ bottom: `${(tick / top) * 100}%` }}>
            <span className="absolute -top-2 -left-9 w-7 text-right text-[10px] text-slate-500 tabular-nums">{formatNumber(tick)}</span>
          </div>
        ))}
        <div className="absolute inset-0 left-9 flex items-end gap-0.5">
          {data.map((d, i) => {
            const height = (d.count / top) * 100;
            const showLabel = d.count > 0 && (i === peak || i === last);
            return (
              <div
                key={d.month}
                tabIndex={0}
                role="img"
                aria-label={`${formatMonth(d.month)}: ${d.count} sold, ${formatCurrency(d.revenue)} revenue`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group relative flex h-full flex-1 cursor-default flex-col items-center justify-end outline-none"
              >
                {showLabel && (
                  <span className="mb-1 text-[11px] font-semibold text-slate-200 tabular-nums">{formatNumber(d.count)}</span>
                )}
                <div
                  className={`w-full max-w-6 rounded-t-[4px] transition-[filter,background-color] duration-150 ${active === i ? "bg-[#ffd84a]" : "bg-poke-gold"}`}
                  style={{ height: `${height}%`, minHeight: d.count > 0 ? 2 : 0 }}
                />
                {active === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-36 -translate-y-1 rounded-xl border border-white/10 bg-navy-800 px-3 py-2 text-left shadow-xl">
                    <p className="text-base font-semibold text-white tabular-nums">{formatNumber(d.count)} sold</p>
                    <p className="text-xs text-slate-300 tabular-nums">{formatCurrency(d.revenue)} revenue</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{formatMonth(d.month)} {d.month.slice(0, 4)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-0.5 pl-9">
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center text-[10px] text-slate-500">
            {formatMonth(d.month)}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">Accounts sold per month for the last 12 months.</figcaption>
      <table className="sr-only">
        <caption>Monthly sales</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Accounts sold</th>
            <th scope="col">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <td>{d.month}</td>
              <td>{d.count}</td>
              <td>{formatCurrency(d.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
