import { CaptureBall } from "./CaptureBall";
import { Mascot } from "./Mascot";
import { MapPin, PokeStop, Sparkle } from "./map-kit";

export type EmptyArtVariant = "search" | "pending" | "activity" | "sales" | "users";

/** Game-style illustrations for empty states. */
export function EmptyArt({ variant = "search", className }: { variant?: EmptyArtVariant; className?: string }) {
  return (
    <svg viewBox="0 0 260 180" className={className} aria-hidden="true">
      {/* folded map */}
      <g transform="translate(20 92)">
        <path d="M0 18 L56 0 L112 18 L168 0 L220 18 L220 78 L168 62 L112 78 L56 62 L0 78 Z" fill="#12295c" />
        <path d="M56 0 L112 18 L112 78 L56 62 Z" fill="#163370" />
        <path d="M168 0 L220 18 L220 78 L168 62 Z" fill="#163370" />
        <path d="M0 18 L56 0 L112 18 L168 0 L220 18" fill="none" stroke="#4fc3ff" strokeOpacity="0.5" strokeWidth="1.5" />
        <path d="M14 56 C40 30 70 64 100 40 S160 30 196 46" fill="none" stroke="#ffcb05" strokeWidth="2.5" strokeDasharray="2 6" strokeLinecap="round" />
        <path d="M30 30 h22 M120 60 h30 M150 30 v18" stroke="#2c56a8" strokeWidth="4" strokeLinecap="round" />
      </g>

      {variant === "search" && (
        <>
          <MapPin x={214} y={128} color="#ef3340" scale={0.9} />
          <text x="206" y="105" fill="#ffffff" fontSize="14" fontWeight="700" fontFamily="var(--font-fredoka), sans-serif">?</text>
          <Mascot x={58} y={8} width={120} height={131} pose="search" />
        </>
      )}

      {variant === "pending" && (
        <>
          <ellipse cx="126" cy="132" rx="58" ry="10" fill="#26a96a" opacity="0.35" />
          <g transform="translate(96 60)">
            <CaptureBall x={0} y={10} size={64} />
          </g>
          <Mascot x={150} y={46} width={84} height={92} pose="sleep" />
          <Sparkle x={80} y={60} size={7} color="#ffcb05" className="animate-twinkle" />
          <Sparkle x={182} y={36} size={6} className="animate-twinkle" />
        </>
      )}

      {variant === "activity" && (
        <>
          {[[40, 126], [62, 116], [86, 122], [108, 110], [132, 116], [154, 104], [178, 110]].map(([x, y], i) => (
            <g key={i} fill="#9fdcff" opacity={0.35 + i * 0.09} transform={`translate(${x} ${y}) rotate(${i % 2 ? 12 : -12})`}>
              <ellipse cx="0" cy="0" rx="4" ry="6" />
              <circle cx="-4" cy="-8" r="1.6" />
              <circle cx="0" cy="-9.5" r="1.6" />
              <circle cx="4" cy="-8" r="1.6" />
            </g>
          ))}
          <PokeStop x={206} y={120} scale={0.8} />
          <Mascot x={10} y={20} width={86} height={94} pose="wave" />
        </>
      )}

      {variant === "sales" && (
        <>
          <g transform="translate(150 66)">
            <ellipse cx="18" cy="52" rx="40" ry="8" fill="#000" opacity="0.25" />
            {[0, 1, 2, 3].map((i) => (
              <g key={i} transform={`translate(${i % 2 ? 22 : 0} ${40 - i * 10})`}>
                <ellipse cx="14" cy="6" rx="16" ry="6" fill="#d99400" />
                <ellipse cx="14" cy="3" rx="16" ry="6" fill="#ffcb05" />
                <ellipse cx="14" cy="3" rx="9" ry="3" fill="none" stroke="#fff3a6" strokeWidth="1.5" />
              </g>
            ))}
          </g>
          <Mascot x={40} y={14} width={110} height={120} pose="wave" />
          <Sparkle x={210} y={46} size={8} color="#ffcb05" className="animate-twinkle" />
        </>
      )}

      {variant === "users" && (
        <>
          <Mascot x={40} y={14} width={100} height={110} pose="wave" />
          <g transform="translate(150 60)">
            <CaptureBall x={0} y={0} size={44} variant="great" />
            <CaptureBall x={40} y={18} size={40} variant="ultra" />
            <CaptureBall x={6} y={38} size={36} />
          </g>
        </>
      )}
    </svg>
  );
}
