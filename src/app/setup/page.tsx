import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Database, KeyRound, Rocket, Terminal } from "lucide-react";
import { MapBackground } from "@/components/art/MapBackground";
import { CaptureBall } from "@/components/art/CaptureBall";
import { requestBackendMode } from "@/lib/server/session";

export const metadata: Metadata = { title: "Setup" };

const STEPS = [
  { icon: Database, title: "Create a Supabase project", body: "Run supabase/migrations/*.sql in the SQL editor (or `supabase db push`)." },
  { icon: KeyRound, title: "Configure environment variables", body: "Copy .env.example to .env.local and fill SUPABASE_URL, SUPABASE_ANON_KEY and CREDENTIALS_ENCRYPTION_KEY." },
  { icon: Terminal, title: "Optional: seed demo data", body: "Add SUPABASE_SERVICE_ROLE_KEY and run `npm run db:seed` for 250 fictional accounts." },
  { icon: Rocket, title: "Restart the server", body: "Or set DEMO_MODE=true to explore with the embedded demo database." },
];

export default async function SetupPage() {
  if ((await requestBackendMode()) !== "unconfigured") redirect("/login");
  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <MapBackground className="absolute inset-0 -z-10 h-full w-full" />
      <div className="glass w-full max-w-xl rounded-[28px] p-8">
        <div className="flex items-center gap-4">
          <CaptureBall size={56} />
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">Finish setting up</h1>
            <p className="text-sm text-slate-300">No backend is configured for this production build.</p>
          </div>
        </div>
        <ol className="mt-7 space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-poke-yellow/15 text-poke-yellow ring-1 ring-poke-yellow/30">
                <step.icon className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-white">
                  {i + 1}. {step.title}
                </p>
                <p className="text-sm text-slate-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
