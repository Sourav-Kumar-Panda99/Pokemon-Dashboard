"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { CaptureBall } from "@/components/art/CaptureBall";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="animate-wobble" style={{ transformOrigin: "50% 90%" }}>
        <CaptureBall size={72} variant="ultra" />
      </div>
      <h1 className="mt-6 font-display text-2xl font-semibold text-white">Oh no — it broke free!</h1>
      <p className="mt-2 max-w-md text-sm text-slate-400">Something went wrong while loading this page. Please try again.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          <RotateCcw className="size-4" /> Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Go home
        </Link>
      </div>
    </div>
  );
}
