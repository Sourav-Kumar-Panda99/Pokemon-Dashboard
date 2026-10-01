import { useId } from "react";

/** Original capture-ball illustration (red/white ball with centre button). */
export function CaptureBall({
  size = 48,
  className,
  title,
  variant = "classic",
  x,
  y,
}: {
  x?: number;
  y?: number;
  size?: number | string;
  className?: string;
  title?: string;
  variant?: "classic" | "great" | "ultra";
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const top = {
    classic: ["#ff8a8f", "#ef3340", "#9f0f1b"],
    great: ["#8ec5ff", "#2f7bff", "#123f9c"],
    ultra: ["#5b6170", "#22262f", "#0b0d12"],
  }[variant];

  return (
    <svg
      viewBox="0 0 100 100"
      x={x}
      y={y}
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <radialGradient id={`${id}t`} cx="34%" cy="22%" r="85%">
          <stop offset="0" stopColor={top[0]} />
          <stop offset="0.45" stopColor={top[1]} />
          <stop offset="1" stopColor={top[2]} />
        </radialGradient>
        <radialGradient id={`${id}b`} cx="34%" cy="18%" r="90%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#e7ecf6" />
          <stop offset="1" stopColor="#9eabc4" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="47" fill="#0b1020" />
      <path d="M6.5 50a43.5 43.5 0 0 1 87 0z" fill={`url(#${id}t)`} />
      <path d="M6.5 50a43.5 43.5 0 0 0 87 0z" fill={`url(#${id}b)`} />
      {variant === "great" && (
        <>
          <path d="M18 24 l12 9 M82 24 l-12 9" stroke="#ef3340" strokeWidth="7" strokeLinecap="round" />
        </>
      )}
      {variant === "ultra" && <path d="M22 18 v18 M78 18 v18" stroke="#ffcb05" strokeWidth="9" strokeLinecap="round" />}
      <rect x="4" y="45.5" width="92" height="9" fill="#0b1020" />
      <circle cx="50" cy="50" r="15" fill="#0b1020" />
      <circle cx="50" cy="50" r="10" fill={`url(#${id}b)`} />
      <circle cx="50" cy="50" r="5.5" fill="#ffffff" stroke="#c9d3e6" strokeWidth="1.5" />
      <ellipse cx="32" cy="24" rx="11" ry="6" fill="#ffffff" opacity="0.45" transform="rotate(-32 32 24)" />
      <ellipse cx="70" cy="80" rx="12" ry="4" fill="#ffffff" opacity="0.18" transform="rotate(-20 70 80)" />
    </svg>
  );
}
