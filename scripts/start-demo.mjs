// Runs the production build against the embedded OFFLINE demo database —
// always, even when .env.local contains real Supabase keys.
//   npm run build && npm run start:demo
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

// Next.js never overrides variables that are already set (even to ""), so
// blanking these keeps .env.local's Supabase keys out of the demo process.
const SUPABASE_KEYS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
];

const child = spawn(process.execPath, [nextBin, "start", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, ...Object.fromEntries(SUPABASE_KEYS.map((key) => [key, ""])), DEMO_MODE: "true" },
});
child.on("exit", (code) => process.exit(code ?? 0));
