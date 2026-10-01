import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE, getSupabaseConfig, hardenCookieOptions } from "@/lib/backend";

/**
 * Request-scoped Supabase client bound to the signed-in user's session.
 * Every query it makes runs as that user, so Postgres RLS applies.
 */
export async function createSupabaseServerClient(options: { remember?: boolean } = {}) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured");
  const store = await cookies();
  const remember = options.remember ?? store.get(REMEMBER_COOKIE)?.value !== "0";

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options: cookieOptions } of cookiesToSet) {
            store.set(name, value, hardenCookieOptions(cookieOptions, value, remember));
          }
        } catch {
          // Called from a Server Component render — proxy.ts refreshes sessions.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS — only used for auth administration
 * (banning disabled users). Never exposed to the browser.
 */
export function createSupabaseServiceClient() {
  const config = getSupabaseConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!config || !serviceKey) return null;
  return createClient(config.url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
