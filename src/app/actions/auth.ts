"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { REMEMBER_COOKIE, getBackendMode, hardenCookieOptions } from "@/lib/backend";
import { callAsUser, createAuthUser, findAuthUserByEmail, touchLastSignIn, verifyPassword } from "@/lib/local-db";
import { clearDemoSession, createDemoSession, getDemoDb } from "@/lib/server/demo";
import { clientIp, rateLimit, resetRateLimit, tooManyAttempts } from "@/lib/server/rate-limit";
import { createSupabaseServerClient } from "@/lib/server/supabase";
import type { Role } from "@/lib/types";
import { fieldErrors, loginSchema, registerSchema } from "@/lib/validation";
import { safeNext } from "./shared";

export interface AuthFormState {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: { email?: string; fullName?: string };
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const INVALID_LOGIN = "Invalid email or password.";
const DISABLED = "This account has been disabled. Contact an administrator.";

type Profile = { role: Role; is_active: boolean } | null;

function destinationFor(role: Role, next: string | null) {
  if (next && (role === "ADMIN" || next.startsWith("/dashboard"))) return next;
  return role === "ADMIN" ? "/admin" : "/dashboard";
}

async function setRememberCookie(remember: boolean) {
  const store = await cookies();
  store.set(REMEMBER_COOKIE, remember ? "1" : "0", hardenCookieOptions({ maxAge: 60 * 60 * 24 * 30 }, "x", true));
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember"),
  });
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")).slice(0, 254) : "";
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: { email } };

  const { password, remember } = parsed.data;
  const normalizedEmail = parsed.data.email;
  const ip = await clientIp();
  const ipLimit = rateLimit(`login:ip:${ip}`, 30, FIFTEEN_MINUTES);
  const emailLimit = rateLimit(`login:email:${normalizedEmail}`, 8, FIFTEEN_MINUTES);
  if (!ipLimit.ok || !emailLimit.ok) {
    return { error: tooManyAttempts(ipLimit.ok ? emailLimit : ipLimit), values: { email } };
  }

  const next = safeNext(formData.get("next"));
  const mode = getBackendMode();
  let role: Role;

  if (mode === "supabase") {
    await setRememberCookie(remember);
    const supabase = await createSupabaseServerClient({ remember });
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error || !data.user) {
      const unconfirmed = error?.code === "email_not_confirmed";
      return { error: unconfirmed ? "Confirm your email address before signing in." : INVALID_LOGIN, values: { email } };
    }
    const { data: profile } = await supabase.rpc("get_my_profile");
    const p = profile as Profile;
    if (!p?.is_active) {
      await supabase.auth.signOut();
      return { error: DISABLED, values: { email } };
    }
    role = p.role;
  } else if (mode === "demo") {
    const db = await getDemoDb();
    const user = await findAuthUserByEmail(db, normalizedEmail);
    const valid = verifyPassword(password, user?.encrypted_password ?? null);
    if (!user || !valid) return { error: INVALID_LOGIN, values: { email } };
    const profile = await callAsUser<Profile>(db, user.id, "get_my_profile");
    if (!profile?.is_active) return { error: DISABLED, values: { email } };
    await touchLastSignIn(db, user.id);
    await createDemoSession(user.id, remember);
    role = profile.role;
  } else {
    return { error: "The application backend is not configured yet." };
  }

  resetRateLimit(`login:email:${normalizedEmail}`);
  redirect(destinationFor(role, next));
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };
  const values = {
    email: typeof raw.email === "string" ? raw.email.slice(0, 254) : "",
    fullName: typeof raw.fullName === "string" ? raw.fullName.slice(0, 80) : "",
  };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const ip = await clientIp();
  const limit = rateLimit(`register:ip:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return { error: tooManyAttempts(limit), values };

  const { email, password, fullName } = parsed.data;
  const mode = getBackendMode();

  if (mode === "supabase") {
    const h = await headers();
    const origin = process.env.SITE_URL || h.get("origin") || "";
    const supabase = await createSupabaseServerClient({ remember: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: origin ? `${origin}/auth/confirm?next=/dashboard` : undefined },
    });
    if (error) {
      return { error: error.code === "weak_password" ? "Choose a stronger password." : "Registration failed. Please try again.", values };
    }
    if (data.session) redirect("/dashboard");
    return { message: "Check your inbox to confirm your email address, then sign in." };
  }

  if (mode === "demo") {
    const db = await getDemoDb();
    if (await findAuthUserByEmail(db, email)) {
      return { fieldErrors: { email: ["An account with this email already exists"] }, values };
    }
    const id = await createAuthUser(db, { email, password, fullName });
    await createDemoSession(id, true);
    redirect("/dashboard");
  }

  return { error: "The application backend is not configured yet." };
}

export async function logoutAction() {
  const mode = getBackendMode();
  if (mode === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } else if (mode === "demo") {
    await clearDemoSession();
  }
  redirect("/login");
}

/** One-click sign-in for the offline demo only. Refused in every other mode. */
export async function demoLoginAction(formData: FormData) {
  if (getBackendMode() !== "demo") redirect("/login");
  const as = formData.get("as") === "admin" ? "admin@example.com" : "submitter@example.com";
  const db = await getDemoDb();
  const user = await findAuthUserByEmail(db, as);
  if (!user) redirect("/login?error=demo");
  await createDemoSession(user.id, false);
  redirect(as.startsWith("admin") ? "/admin" : "/dashboard");
}
