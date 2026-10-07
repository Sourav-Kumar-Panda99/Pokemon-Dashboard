import Link from "next/link";
import { EmptyArt } from "@/components/art/EmptyArt";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 py-16 text-center">
      <EmptyArt variant="search" className="w-72 max-w-full" />
      <p className="mt-4 font-display text-6xl font-bold text-gradient-gold">404</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-white">This area isn&apos;t on the map</h1>
      <p className="mt-2 max-w-md text-sm text-slate-400">The page or account you are looking for doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/" className="btn btn-primary mt-6">
        Back to dashboard
      </Link>
    </div>
  );
}
