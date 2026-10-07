import { useId } from "react";
import { Gym, MapPin, PokeStop, Silhouette, Sparkle, Trainer, isoProject, seeded } from "./map-kit";

const ROADS = [-360, -120, 120, 360];
const ROAD = 24;

/** Full-screen night city map used behind the auth screens. */
export function MapBackground({ className }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const rand = seeded(42);
  const iso = isoProject(800, 830, 0.42);

  const stars = Array.from({ length: 120 }, () => ({
    x: rand() * 1600,
    y: rand() * 420,
    r: rand() * 1.4 + 0.3,
    delay: rand() * 3,
  }));

  const skyline: Array<{ x: number; w: number; h: number; windows: Array<[number, number]> }> = [];
  for (let x = -20; x < 1620; ) {
    const w = 28 + rand() * 60;
    const h = 30 + rand() * (x > 500 && x < 1100 ? 170 : 110);
    const windows: Array<[number, number]> = [];
    for (let wy = 10; wy < h - 8; wy += 14) {
      for (let wx = 6; wx < w - 6; wx += 11) if (rand() < 0.18) windows.push([wx, wy]);
    }
    skyline.push({ x, w, h, windows });
    x += w + 4 + rand() * 10;
  }

  const cells: Array<{ x: number; y: number; w: number; h: number; kind: "block" | "park" | "water" }> = [];
  const edges = [-600, ...ROADS, 600];
  for (let i = 0; i < edges.length - 1; i++) {
    for (let j = 0; j < edges.length - 1; j++) {
      const pad = 22;
      const kind = (i === 1 && j === 3) || (i === 3 && j === 1) ? "park" : i === 4 && j === 2 ? "water" : "block";
      cells.push({ x: edges[i] + pad, y: edges[j] + pad, w: edges[i + 1] - edges[i] - pad * 2, h: edges[j + 1] - edges[j] - pad * 2, kind });
    }
  }

  const stops = [iso(-240, -240), iso(0, -260), iso(250, -10), iso(-260, 230), iso(20, 250), iso(300, 300), iso(-480, -20)];
  const gyms: Array<{ p: [number, number]; team: "red" | "blue" | "yellow" }> = [
    { p: iso(240, -250), team: "blue" },
    { p: iso(-280, 0), team: "red" },
    { p: iso(480, 240), team: "yellow" },
  ];
  const trainer = iso(0, 0);
  const routeA = [iso(0, 0), iso(0, -120), iso(120, -120), iso(120, -250), iso(240, -250)];
  const routeB = [iso(0, 0), iso(-120, 0), iso(-120, 120), iso(-260, 120), iso(-260, 230)];

  return (
    <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#030817" />
          <stop offset="0.45" stopColor="#0a1a48" />
          <stop offset="0.62" stopColor="#173a86" />
          <stop offset="1" stopColor="#0a1638" />
        </linearGradient>
        <linearGradient id={`${id}ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#10295c" />
          <stop offset="1" stopColor="#081633" />
        </linearGradient>
        <radialGradient id={`${id}moon`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff6c8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff6c8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}horizon`} cx="50%" cy="100%" r="70%">
          <stop offset="0" stopColor="#4fc3ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#4fc3ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}gold`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffcb05" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffcb05" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#040a1c" stopOpacity="0" />
          <stop offset="1" stopColor="#040a1c" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      <rect width="1600" height="1000" fill={`url(#${id}sky)`} />
      {stars.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="#ffffff"
          className={i % 3 === 0 ? "animate-twinkle" : undefined}
          style={i % 3 === 0 ? { animationDelay: `${s.delay.toFixed(2)}s` } : undefined}
          opacity={i % 3 === 0 ? undefined : 0.55}
        />
      ))}
      <circle cx="1330" cy="150" r="140" fill={`url(#${id}moon)`} />
      <circle cx="1330" cy="150" r="44" fill="#fff4cf" />
      <circle cx="1346" cy="140" r="38" fill="#0b1a48" opacity="0.12" />

      <ellipse cx="800" cy="450" rx="900" ry="200" fill={`url(#${id}horizon)`} />
      <g fill="#0a1636">
        {skyline.map((b, i) => (
          <g key={i} transform={`translate(${b.x.toFixed(1)} ${(452 - b.h).toFixed(1)})`}>
            <rect width={b.w} height={b.h} />
            {b.windows.map(([wx, wy], k) => (
              <rect key={k} x={wx} y={wy} width="5" height="6" fill="#ffd86b" opacity="0.55" />
            ))}
          </g>
        ))}
      </g>

      <rect y="448" width="1600" height="552" fill={`url(#${id}ground)`} />

      <g transform="translate(800 830) scale(1 0.42) rotate(45)">
        <rect x="-600" y="-600" width="1200" height="1200" fill="#0f2658" />
        {Array.from({ length: 21 }, (_, i) => -600 + i * 60).map((v) => (
          <g key={v} stroke="#4fc3ff" strokeOpacity="0.07" strokeWidth="2">
            <line x1={v} y1="-600" x2={v} y2="600" />
            <line x1="-600" y1={v} x2="600" y2={v} />
          </g>
        ))}
        {cells.map((c, i) =>
          c.kind === "park" ? (
            <g key={i}>
              <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="18" fill="#17654a" />
              {[0.2, 0.5, 0.8].flatMap((fx) => [0.3, 0.72].map((fy) => (
                <circle key={`${fx}-${fy}`} cx={c.x + c.w * fx} cy={c.y + c.h * fy} r="16" fill="#26a96a" opacity="0.85" />
              )))}
            </g>
          ) : c.kind === "water" ? (
            <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx="40" fill="#1d5bd6" opacity="0.8" />
          ) : (
            <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx="10" fill="#122d66" stroke="#2c56a8" strokeOpacity="0.45" strokeWidth="2" />
          ),
        )}
        {ROADS.map((v) => (
          <g key={v}>
            <rect x={v - ROAD / 2} y="-600" width={ROAD} height="1200" fill="#1d438c" />
            <rect x="-600" y={v - ROAD / 2} width="1200" height={ROAD} fill="#1d438c" />
            <line x1={v} y1="-600" x2={v} y2="600" stroke="#9fdcff" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="14 16" />
            <line x1="-600" y1={v} x2="600" y2={v} stroke="#9fdcff" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="14 16" />
          </g>
        ))}
      </g>

      {[routeA, routeB].map((route, i) => (
        <polyline
          key={i}
          points={route.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="#ffcb05"
          strokeWidth="4"
          strokeDasharray="2 10"
          strokeLinecap="round"
          opacity="0.85"
        />
      ))}

      <Silhouette x={iso(-140, -200)[0]} y={iso(-140, -200)[1]} kind="sprout" scale={1.1} />
      <Silhouette x={iso(380, 60)[0]} y={iso(380, 60)[1]} kind="drake" scale={1.1} />
      <Silhouette x={iso(-380, 300)[0]} y={iso(-380, 300)[1]} kind="pup" scale={1.2} />
      <Silhouette x={iso(160, 380)[0]} y={iso(160, 380)[1]} kind="blob" scale={1.2} />
      <Silhouette x={420} y={330} kind="bird" scale={1} />
      <Silhouette x={1180} y={300} kind="bird" scale={0.7} />

      {stops.map(([x, y], i) => (
        <PokeStop key={i} x={x} y={y} scale={1.05} lured={i === 2} />
      ))}
      {gyms.map(({ p, team }, i) => (
        <Gym key={i} x={p[0]} y={p[1]} scale={1.1} team={team} />
      ))}
      <MapPin x={iso(360, -360)[0]} y={iso(360, -360)[1]} scale={1.1} />
      <MapPin x={iso(-360, -120)[0]} y={iso(-360, -120)[1]} color="#ffcb05" scale={1} />

      <ellipse
        cx={trainer[0]}
        cy={trainer[1]}
        rx="60"
        ry="25"
        fill="none"
        stroke="#4fc3ff"
        strokeWidth="3"
        className="animate-pulse-ring"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <Trainer x={trainer[0]} y={trainer[1]} scale={1.5} />

      <Sparkle x={240} y={210} size={10} color="#ffcb05" className="animate-twinkle" />
      <Sparkle x={1460} y={380} size={8} className="animate-twinkle" />
      <Sparkle x={980} y={120} size={7} color="#9fdcff" className="animate-twinkle" />

      <circle cx="160" cy="900" r="420" fill={`url(#${id}gold)`} />
      <rect width="1600" height="1000" fill={`url(#${id}fade)`} />
    </svg>
  );
}
