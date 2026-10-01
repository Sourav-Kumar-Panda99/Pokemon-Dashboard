// Backend selection. Imported by proxy.ts too, so it must stay free of
// `server-only` and Node-only APIs.

export type BackendMode = "supabase" | "demo" | "unconfigured";

export const DEMO_SESSION_COOKIE = "gam_demo_session";
export const REMEMBER_COOKIE = "gam_remember";

export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/**
 * - `supabase`     when Supabase credentials are configured (production path)
 * - `demo`         offline demo backed by an embedded Postgres, enabled with
 *                  DEMO_MODE=true or automatically during `next dev`
 * - `unconfigured` production build without a backend → setup screen
 */
export function getBackendMode(): BackendMode {
  if (getSupabaseConfig()) return "supabase";
  if (process.env.DEMO_MODE === "true") return "demo";
  if (process.env.DEMO_MODE !== "false" && process.env.NODE_ENV !== "production") return "demo";
  return "unconfigured";
}

type CookieOptions = {
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none" | boolean;
  path?: string;
  domain?: string;
  [key: string]: unknown;
};

/**
 * Session cookies are only ever read on the server, so they are HttpOnly.
 * Without "remember me" they become browser-session cookies.
 */
export function hardenCookieOptions<T extends CookieOptions>(options: T | undefined, value: string, remember: boolean): T {
  const hardened = {
    ...(options ?? {}),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  } as T;
  const isDeletion = value === "" || (typeof hardened.maxAge === "number" && hardened.maxAge <= 0);
  if (!remember && !isDeletion) {
    delete hardened.maxAge;
    delete hardened.expires;
  }
  return hardened;
}
