import { MapBackground } from "@/components/art/MapBackground";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 pt-20 pb-10 sm:py-20">
      <MapBackground className="absolute inset-0 -z-10 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(4,10,28,0.15),rgba(4,10,28,0.7))]" />
      {children}
    </div>
  );
}
