import { avatarGradient, initials } from "@/lib/format";

export function Avatar({
  name,
  seed,
  size = "md",
  className = "",
}: {
  name: string | null | undefined;
  seed?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    xs: "size-6 text-[10px]",
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
    xl: "size-20 text-2xl",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-display font-bold text-white ring-2 ring-white/10 ${avatarGradient(seed ?? name)} ${sizes[size]} ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
