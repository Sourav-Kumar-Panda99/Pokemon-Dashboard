import { useId } from "react";

/**
 * "Sparky" — an ORIGINAL electric-mouse style mascot drawn for this app
 * (not a copy of any official character artwork).
 */
export function Mascot({
  className,
  width = 220,
  height,
  x,
  y,
  pose = "wave",
  title,
}: {
  className?: string;
  width?: number | string;
  height?: number | string;
  x?: number;
  y?: number;
  pose?: "wave" | "search" | "sleep";
  title?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const outline = "#5b3a12";
  const sleeping = pose === "sleep";

  return (
    <svg
      viewBox="0 0 220 240"
      width={width}
      height={height}
      x={x}
      y={y}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <radialGradient id={`${id}fur`} cx="38%" cy="28%" r="80%">
          <stop offset="0" stopColor="#fff4b0" />
          <stop offset="0.42" stopColor="#ffd83a" />
          <stop offset="1" stopColor="#efa908" />
        </radialGradient>
        <radialGradient id={`${id}cheek`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ff8a7a" />
          <stop offset="1" stopColor="#e0323e" />
        </radialGradient>
        <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* shadow */}
      <ellipse cx="112" cy="228" rx="62" ry="9" fill="#000" opacity="0.28" />

      {/* lightning tail */}
      <path
        d="M146 176 L184 156 L170 134 L204 110 L188 90 L214 62 L166 82 L180 102 L146 122 L160 142 L132 158 Z"
        fill={`url(#${id}fur)`}
        stroke={outline}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M146 176 L160 168 L152 154 L136 162 Z" fill="#9a6420" stroke={outline} strokeWidth="2" strokeLinejoin="round" />

      {/* ears */}
      <path d="M74 66 C60 46 42 22 26 6 C50 12 78 32 98 56 Z" fill={`url(#${id}fur)`} stroke={outline} strokeWidth="3" strokeLinejoin="round" />
      <path d="M26 6 C36 10 46 17 54 25 L44 33 C38 22 32 13 26 6 Z" fill="#2a1b0d" />
      <path d="M146 66 C160 46 178 22 194 6 C170 12 142 32 122 56 Z" fill={`url(#${id}fur)`} stroke={outline} strokeWidth="3" strokeLinejoin="round" />
      <path d="M194 6 C184 10 174 17 166 25 L176 33 C182 22 188 13 194 6 Z" fill="#2a1b0d" />

      {/* body */}
      <ellipse cx="110" cy="178" rx="52" ry="47" fill={`url(#${id}fur)`} stroke={outline} strokeWidth="3" />
      <ellipse cx="110" cy="186" rx="30" ry="25" fill="#fff6c9" opacity="0.35" />
      <ellipse cx="84" cy="222" rx="17" ry="8" fill="#f1b512" stroke={outline} strokeWidth="2.5" />
      <ellipse cx="136" cy="222" rx="17" ry="8" fill="#f1b512" stroke={outline} strokeWidth="2.5" />

      {/* arms */}
      {pose === "wave" ? (
        <>
          <ellipse cx="80" cy="164" rx="13" ry="8" transform="rotate(-25 80 164)" fill="#ffd83a" stroke={outline} strokeWidth="2.5" />
          <ellipse cx="160" cy="138" rx="13" ry="8" transform="rotate(-60 160 138)" fill="#ffd83a" stroke={outline} strokeWidth="2.5" />
        </>
      ) : pose === "search" ? (
        <>
          <ellipse cx="80" cy="164" rx="13" ry="8" transform="rotate(-25 80 164)" fill="#ffd83a" stroke={outline} strokeWidth="2.5" />
          <line x1="156" y1="160" x2="182" y2="186" stroke="#3a4a6b" strokeWidth="7" strokeLinecap="round" />
          <circle cx="150" cy="150" r="20" fill="#bfe8ff" fillOpacity="0.35" stroke="#3a4a6b" strokeWidth="6" />
          <ellipse cx="143" cy="143" rx="6" ry="3.5" fill="#fff" opacity="0.7" transform="rotate(-35 143 143)" />
          <ellipse cx="140" cy="166" rx="12" ry="8" transform="rotate(20 140 166)" fill="#ffd83a" stroke={outline} strokeWidth="2.5" />
        </>
      ) : (
        <>
          <ellipse cx="86" cy="170" rx="13" ry="8" transform="rotate(10 86 170)" fill="#ffd83a" stroke={outline} strokeWidth="2.5" />
          <ellipse cx="134" cy="170" rx="13" ry="8" transform="rotate(-10 134 170)" fill="#ffd83a" stroke={outline} strokeWidth="2.5" />
        </>
      )}

      {/* head */}
      <ellipse cx="110" cy="104" rx="66" ry="56" fill={`url(#${id}fur)`} stroke={outline} strokeWidth="3" />
      <path d="M100 52 l8 12 l-6 2 l8 12" fill="none" stroke="#efa908" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* face */}
      {sleeping ? (
        <>
          <path d="M74 100 q10 8 20 0" fill="none" stroke="#1d1208" strokeWidth="4" strokeLinecap="round" />
          <path d="M126 100 q10 8 20 0" fill="none" stroke="#1d1208" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="84" cy="98" r="10.5" fill="#1d1208" />
          <circle cx="87.5" cy="93.5" r="3.8" fill="#fff" />
          <circle cx="81" cy="102" r="1.6" fill="#fff" opacity="0.7" />
          <circle cx="136" cy="98" r="10.5" fill="#1d1208" />
          <circle cx="139.5" cy="93.5" r="3.8" fill="#fff" />
          <circle cx="133" cy="102" r="1.6" fill="#fff" opacity="0.7" />
        </>
      )}
      <path d="M106 110 q4 3 8 0 q-4 5 -8 0z" fill="#1d1208" />
      <path d="M98 118 q6 8 12 0 q6 8 12 0" fill="none" stroke={outline} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="64" cy="120" r="12.5" fill={`url(#${id}cheek)`} />
      <circle cx="156" cy="120" r="12.5" fill={`url(#${id}cheek)`} />
      <circle cx="60" cy="116" r="3.5" fill="#fff" opacity="0.35" />
      <circle cx="152" cy="116" r="3.5" fill="#fff" opacity="0.35" />

      {/* sparks */}
      {!sleeping && (
        <g stroke="#fff27a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M38 112 l-10 -4 l6 -6 l-10 -4" filter={`url(#${id}glow)`} opacity="0.9" />
          <path d="M38 112 l-10 -4 l6 -6 l-10 -4" />
          <path d="M182 112 l10 -4 l-6 -6 l10 -4" filter={`url(#${id}glow)`} opacity="0.9" />
          <path d="M182 112 l10 -4 l-6 -6 l10 -4" />
        </g>
      )}
      {sleeping && (
        <g fill="#c7d7ff" fontFamily="var(--font-fredoka), sans-serif" fontWeight="700">
          <text x="170" y="56" fontSize="22">z</text>
          <text x="188" y="36" fontSize="16" opacity="0.8">z</text>
          <text x="201" y="20" fontSize="12" opacity="0.6">z</text>
        </g>
      )}
    </svg>
  );
}
