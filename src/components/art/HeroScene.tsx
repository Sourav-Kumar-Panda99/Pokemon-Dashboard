import { useId } from "react";
import { CaptureBall } from "./CaptureBall";
import { Mascot } from "./Mascot";
import { Gym, MapPin, PokeStop, Silhouette, Sparkle, Trainer, isoProject } from "./map-kit";

const ROADS_X = [-90, 50];
const ROADS_Y = [-120, 0, 120];
const ROAD = 16;

/** Night-time isometric city map with gyms, stops, mascot and a floating capture ball. */
export function HeroScene({ className, mascot = true }: { className?: string; mascot?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const iso = isoProject(330, 205);

  // City blocks between the roads (map space).
  const xs = [-200, ...ROADS_X, 200];
  const ys = [-200, ...ROADS_Y, 200];
  const blocks: Array<{ x: number; y: number; w: number; h: number; kind: "block" | "park" | "water" }> = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x = xs[i] + (i === 0 ? 14 : ROAD / 2 + 8);
      const y = ys[j] + (j === 0 ? 14 : ROAD / 2 + 8);
      const w = xs[i + 1] - xs[i] - (i === 0 ? 14 : ROAD / 2 + 8) - (i === xs.length - 2 ? 14 : ROAD / 2 + 8);
      const h = ys[j + 1] - ys[j] - (j === 0 ? 14 : ROAD / 2 + 8) - (j === ys.length - 2 ? 14 : ROAD / 2 + 8);
      const kind = i === 1 && j === 1 ? "park" : i === 2 && j === 3 ? "water" : "block";
      blocks.push({ x, y, w, h, kind });
    }
  }

  const gym = iso(125, -160);
  const stops = [iso(-150, -50), iso(-20, 70), iso(150, 40), iso(-150, 160)];
  const trainer = iso(-20, -20);
  const route = [iso(-20, -20), iso(-20, -60), iso(50, -60), iso(50, -120), iso(125, -120), iso(125, -160)];

  return (
    <svg viewBox="0 0 640 400" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#4fc3ff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#4fc3ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}gold`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffcb05" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffcb05" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}ground`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#143066" />
          <stop offset="1" stopColor="#0a1a40" />
        </linearGradient>
      </defs>

      <ellipse cx="330" cy="210" rx="300" ry="170" fill={`url(#${id}glow)`} opacity="0.55" />

      {/* map plane */}
      <g transform="translate(330 205) scale(1 0.56) rotate(45)">
        <rect x="-206" y="-206" width="412" height="412" rx="34" fill="#4fc3ff" opacity="0.08" />
        <rect x="-200" y="-200" width="400" height="400" rx="30" fill={`url(#${id}ground)`} stroke="#4fc3ff" strokeOpacity="0.35" strokeWidth="2" />
        {blocks.map((b, i) =>
          b.kind === "park" ? (
            <g key={i}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="10" fill="#1a6a4c" />
              {[0.25, 0.6, 0.8].map((fx, k) => (
                <circle key={k} cx={b.x + b.w * fx} cy={b.y + b.h * (k === 1 ? 0.3 : 0.65)} r="9" fill="#2bb673" opacity="0.9" />
              ))}
            </g>
          ) : b.kind === "water" ? (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="16" fill="#1d5bd6" opacity="0.85" />
          ) : (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="7" fill="#112a5e" stroke="#2a4f9a" strokeOpacity="0.5" />
          ),
        )}
        {ROADS_X.map((x) => (
          <g key={`rx${x}`}>
            <rect x={x - ROAD / 2} y="-200" width={ROAD} height="400" fill="#1f4590" />
            <line x1={x} y1="-196" x2={x} y2="196" stroke="#9fdcff" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="8 10" />
          </g>
        ))}
        {ROADS_Y.map((y) => (
          <g key={`ry${y}`}>
            <rect x="-200" y={y - ROAD / 2} width="400" height={ROAD} fill="#1f4590" />
            <line x1="-196" y1={y} x2="196" y2={y} stroke="#9fdcff" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="8 10" />
          </g>
        ))}
      </g>

      {/* route to the gym */}
      <polyline
        points={route.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="#ffcb05"
        strokeWidth="3"
        strokeDasharray="2 7"
        strokeLinecap="round"
        opacity="0.9"
      />

      <Silhouette x={iso(-130, 80)[0]} y={iso(-130, 80)[1]} kind="sprout" scale={0.75} />
      <Silhouette x={iso(90, 120)[0]} y={iso(90, 120)[1]} kind="pup" scale={0.7} />
      <Silhouette x={250} y={78} kind="bird" scale={0.6} />

      {stops.map(([x, y], i) => (
        <PokeStop key={i} x={x} y={y} scale={0.72} lured={i === 1} />
      ))}
      <Gym x={gym[0]} y={gym[1]} scale={0.82} team="yellow" />
      <MapPin x={iso(-120, -150)[0]} y={iso(-120, -150)[1]} color="#ef3340" scale={0.8} />
      <MapPin x={iso(160, 150)[0]} y={iso(160, 150)[1]} color="#ffcb05" scale={0.7} />
      <Trainer x={trainer[0]} y={trainer[1]} scale={0.85} />

      {/* floating capture ball */}
      <g className="animate-float">
        <circle cx="120" cy="104" r="62" fill={`url(#${id}gold)`} />
        <ellipse cx="120" cy="104" rx="52" ry="52" fill="none" stroke="#ffcb05" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="4 8" />
        <CaptureBall x={78} y={62} size={84} variant="classic" />
      </g>

      {mascot && (
        <g className="animate-float-slow">
          <Mascot x={440} y={150} width={185} height={202} pose="wave" />
        </g>
      )}

      <Sparkle x={70} y={190} size={7} className="animate-twinkle" />
      <Sparkle x={205} y={40} size={9} color="#ffcb05" className="animate-twinkle" />
      <Sparkle x={600} y={120} size={6} className="animate-twinkle" />
      <Sparkle x={560} y={60} size={10} color="#9fdcff" className="animate-twinkle" />
      <Sparkle x={380} y={30} size={5} className="animate-twinkle" />
    </svg>
  );
}
