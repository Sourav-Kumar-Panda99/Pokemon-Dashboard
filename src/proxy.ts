import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEMO_SESSION_COOKIE, REMEMBER_COOKIE, getBackendMode, getSupabaseConfig, hardenCookieOptions } from "@/lib/backend";

// Proxy = optimistic gatekeeping + Supabase session refresh. The authoritative
// checks live in layouts, pages, server actions and Postgres RLS.

const PROTECTED_PREFIXES = ["/admin", "/dashboard"];

function loginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Server Action calls are never redirected: an HTML login page is not a valid
  // action response. Each action authorises the caller itself and returns a
  // "session expired" error instead.
  const isServerAction = request.method === "POST" && request.headers.has("next-action");
  const isProtected =
    !isServerAction && PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const mode = getBackendMode();

  if (mode === "unconfigured") {
    if (pathname === "/setup") return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/setup";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (mode === "demo") {
    if (isProtected && !request.cookies.has(DEMO_SESSION_COOKIE)) return loginRedirect(request);
    return NextResponse.next();
  }

  // Supabase: refresh the session cookie on every navigation.
  const config = getSupabaseConfig()!;
  const remember = request.cookies.get(REMEMBER_COOKIE)?.value !== "0";
  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, hardenCookieOptions(options, value, remember));
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (isProtected && !signedIn) {
    const redirect = loginRedirect(request);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
