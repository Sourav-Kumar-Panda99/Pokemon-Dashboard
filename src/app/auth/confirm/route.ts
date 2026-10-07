import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getBackendMode } from "@/lib/backend";
import { createSupabaseServerClient } from "@/lib/server/supabase";

// Landing route for Supabase email confirmation / magic links.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = /^\/(admin|dashboard)(\/|$)/.test(nextParam) ? nextParam : "/dashboard";

  if (getBackendMode() !== "supabase") return NextResponse.redirect(new URL("/login", request.url));

  const supabase = await createSupabaseServerClient({ remember: true });
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=confirm", request.url));
}
