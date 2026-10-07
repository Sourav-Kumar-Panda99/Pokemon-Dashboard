import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getBackendMode, type BackendMode } from "@/lib/backend";
import { callAsUser } from "@/lib/local-db";
import type { CurrentUser, Role } from "@/lib/types";
import { getDemoDb, readDemoSession } from "./demo";
import { createSupabaseServerClient } from "./supabase";

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

function toCurrentUser(profile: ProfileRow): CurrentUser {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name || profile.email.split("@")[0],
    role: profile.role,
    isActive: profile.is_active,
    createdAt: profile.created_at,
  };
}

/**
 * The verified user for this request (deduplicated per request).
 * Supabase: `getUser()` validates the session with the Auth server.
 * Demo: HMAC-signed session cookie.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const mode = await requestBackendMode();

  if (mode === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const { data: profile } = await supabase.rpc("get_my_profile");
    return profile ? toCurrentUser(profile as ProfileRow) : null;
  }

  if (mode === "demo") {
    const session = await readDemoSession();
    if (!session) return null;
    const db = await getDemoDb();
    const profile = await callAsUser<ProfileRow | null>(db, session.userId, "get_my_profile");
    return profile ? toCurrentUser(profile) : null;
  }

  return null;
});

/**
 * Backend mode resolved at request time. Awaiting `connection()` keeps every
 * auth-dependent page out of build-time prerendering, so environment
 * variables provided only at runtime are always honoured.
 */
export async function requestBackendMode(): Promise<BackendMode> {
  await connection();
  return getBackendMode();
}

/** For pages/layouts: redirects anonymous or disabled users to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isActive) redirect("/login?error=disabled");
  return user;
}

/** For admin pages/layouts: submitters are sent to their own dashboard. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export class AuthorizationError extends Error {}

/** For server actions: throws instead of redirecting. */
export async function assertUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Your session has expired. Please sign in again.");
  if (!user.isActive) throw new AuthorizationError("Your account has been disabled.");
  return user;
}

export async function assertAdmin(): Promise<CurrentUser> {
  const user = await assertUser();
  if (user.role !== "ADMIN") throw new AuthorizationError("Admin access required.");
  return user;
}

export function homeFor(user: Pick<CurrentUser, "role">) {
  return user.role === "ADMIN" ? "/admin" : "/dashboard";
}
