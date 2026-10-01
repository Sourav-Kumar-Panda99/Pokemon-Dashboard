import type { ReactNode } from "react";

// Small SVG building blocks for the map scenes. Each returns a <g> to be
// placed inside a parent <svg>. Solid fills only (no gradient ids), so they
// can be reused any number of times on one page.

export type Team = "red" | "blue" | "yellow";
const TEAM_COLORS: Record<Team, string> = { red: "#ff4757", blue: "#3d8bff", yellow: "#ffcb05" };

/** Seeded PRNG so server and client renders always match. */
export function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Isometric projection used by every map: rotate 45°, squash vertically. */
export function isoProject(originX: number, originY: number, squash = 0.56) {
  const c = Math.SQRT1_2;
  return (x: number, y: number): [number, number] => [originX + (x - y) * c, originY + (x + y) * c * squash];
}

export function PokeStop({ x, y, scale = 1, lured = false }: { x: number; y: number; scale?: number; lured?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="20" ry="6.5" fill={lured ? "#ff6ad5" : "#4fc3ff"} opacity="0.28" />
      <ellipse cx="0" cy="0" rx="9" ry="3" fill="#bfe9ff" opacity="0.5" />
      <rect x="-1.6" y="-40" width="3.2" height="40" rx="1.6" fill="#a9ddff" />
      <g transform="translate(0 -50)">
        <circle r="15" fill="none" stroke={lured ? "#ff6ad5" : "#4fc3ff"} strokeWidth="2" opacity="0.55" />
        <rect x="-8" y="-8" width="16" height="16" rx="3.5" transform="rotate(45)" fill="#1fa6ff" />
        <path d="M0 -11.3 L11.3 0 L0 0 Z" fill="#7fd3ff" />
        <path d="M0 0 L-11.3 0 L0 11.3 Z" fill="#0b7fd1" />
        <circle r="3" fill="#ffffff" opacity="0.9" />
      </g>
    </g>
  );
}

export function Gym({ x, y, scale = 1, team = "blue" }: { x: number; y: number; scale?: number; team?: Team }) {
  const color = TEAM_COLORS[team];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-4" y="-170" width="8" height="90" rx="4" fill={color} opacity="0.18" />
      <rect x="-1.5" y="-170" width="3" height="90" rx="1.5" fill={color} opacity="0.35" />
      <ellipse cx="0" cy="0" rx="40" ry="13" fill={color} opacity="0.2" />
      <ellipse cx="0" cy="-2" rx="30" ry="9.5" fill="#16264f" stroke={color} strokeOpacity="0.7" strokeWidth="2" />
      <path d="M-14 -2 L-9 -66 L9 -66 L14 -2 Z" fill="#cdd9f4" />
      <path d="M0 -2 L0 -66 L9 -66 L14 -2 Z" fill="#8fa4d2" />
      <rect x="-18" y="-74" width="36" height="9" rx="4.5" fill="#eef3ff" />
      <rect x="-18" y="-70" width="36" height="5" rx="2.5" fill="#b7c6ea" />
      <circle cx="0" cy="-90" r="15" fill={color} stroke="#ffffff" strokeWidth="3" />
      <path d="M-6 -90 l6 -8 l6 8 l-6 8 z" fill="#ffffff" opacity="0.92" />
    </g>
  );
}

export function MapPin({ x, y, color = "#ef3340", scale = 1 }: { x: number; y: number; color?: string; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="1" rx="9" ry="3" fill="#000" opacity="0.35" />
      <path d="M0 0 C-9 -12 -14 -19 -14 -28 A14 14 0 1 1 14 -28 C14 -19 9 -12 0 0 Z" fill={color} />
      <path d="M0 0 C-9 -12 -14 -19 -14 -28 A14 14 0 0 1 0 -42 Z" fill="#ffffff" opacity="0.15" />
      <circle cx="0" cy="-28" r="5.5" fill="#ffffff" />
    </g>
  );
}

export function Sparkle({ x, y, size = 8, color = "#fff6b0", opacity = 1, className }: { x: number; y: number; size?: number; color?: string; opacity?: number; className?: string }) {
  const s = size;
  const k = s * 0.22;
  return (
    <path
      className={className}
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      d={`M${x} ${y - s} L${x + k} ${y - k} L${x + s} ${y} L${x + k} ${y + k} L${x} ${y + s} L${x - k} ${y + k} L${x - s} ${y} L${x - k} ${y - k} Z`}
      fill={color}
      opacity={opacity}
    />
  );
}

/** Original creature silhouettes (generic shapes, not specific characters). */
export function Silhouette({
  x,
  y,
  kind,
  scale = 1,
  color = "#0a1430",
  glow = "#4fc3ff",
}: {
  x: number;
  y: number;
  kind: "sprout" | "bird" | "pup" | "drake" | "blob";
  scale?: number;
  color?: string;
  glow?: string;
}) {
  const shapes: Record<typeof kind, ReactNode> = {
    sprout: (
      <>
        <ellipse cx="0" cy="-14" rx="18" ry="13" />
        <path d="M-4 -26 C-16 -44 -2 -52 4 -40 C14 -50 22 -36 6 -27 Z" />
        <rect x="-12" y="-6" width="7" height="8" rx="3" />
        <rect x="5" y="-6" width="7" height="8" rx="3" />
      </>
    ),
    bird: (
      <path d="M-30 -40 C-18 -46 -8 -42 0 -34 C8 -44 20 -48 34 -42 C22 -38 12 -30 6 -22 C10 -18 12 -12 8 -8 L0 -14 L-8 -8 C-12 -12 -10 -18 -6 -22 C-12 -30 -20 -36 -30 -40 Z" />
    ),
    pup: (
      <>
        <ellipse cx="0" cy="-12" rx="20" ry="12" />
        <circle cx="16" cy="-26" r="10" />
        <path d="M10 -34 L12 -46 L18 -35 Z M20 -34 L26 -44 L26 -31 Z" />
        <path d="M-18 -16 C-30 -24 -32 -34 -26 -38 C-24 -28 -18 -24 -12 -22 Z" />
        <rect x="-14" y="-4" width="6" height="8" rx="3" />
        <rect x="8" y="-4" width="6" height="8" rx="3" />
      </>
    ),
    drake: (
      <>
        <path d="M-26 0 C-28 -18 -14 -30 4 -28 C16 -27 22 -38 20 -50 C30 -42 30 -26 22 -18 C30 -12 30 -2 22 0 Z" />
        <path d="M-4 -26 C-16 -48 -36 -50 -46 -38 C-30 -38 -22 -32 -14 -22 Z" />
        <circle cx="21" cy="-52" r="6" />
      </>
    ),
    blob: (
      <>
        <path d="M-18 0 C-22 -16 -14 -30 0 -30 C14 -30 22 -16 18 0 Z" />
        <circle cx="-9" cy="-33" r="5" />
        <circle cx="9" cy="-33" r="5" />
      </>
    ),
  };
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="1" rx="22" ry="5" fill={glow} opacity="0.18" />
      <g fill={color} stroke={glow} strokeOpacity="0.55" strokeWidth="1.6" strokeLinejoin="round">
        {shapes[kind]}
      </g>
    </g>
  );
}

export function Trainer({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="34" ry="11" fill="none" stroke="#4fc3ff" strokeWidth="2" opacity="0.55" />
      <ellipse cx="0" cy="0" rx="20" ry="6.5" fill="#4fc3ff" opacity="0.25" />
      <path d="M-7 -2 L-5 -22 L5 -22 L7 -2 Z" fill="#1f3c88" />
      <path d="M-9 -22 C-9 -36 9 -36 9 -22 Z" fill="#ffcb05" />
      <rect x="-9" y="-38" width="18" height="5" rx="2.5" fill="#ef3340" />
      <circle cx="0" cy="-42" r="7.5" fill="#ffd9b8" />
      <path d="M-8 -45 C-8 -54 8 -54 8 -45 Z" fill="#ef3340" />
      <rect x="-10" y="-46" width="20" height="3" rx="1.5" fill="#ffffff" />
    </g>
  );
}
