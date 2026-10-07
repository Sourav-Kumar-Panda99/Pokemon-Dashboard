"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBackendMode } from "@/lib/backend";
import { findAuthUserByEmail, hashPassword, verifyPassword } from "@/lib/local-db";
import { getDemoDb } from "@/lib/server/demo";
import { rateLimit, tooManyAttempts } from "@/lib/server/rate-limit";
import * as repo from "@/lib/server/repo";
import { assertAdmin, assertUser } from "@/lib/server/session";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/server/supabase";
import type { ActionResult, Role } from "@/lib/types";
import { changePasswordSchema, fieldErrors, profileSchema } from "@/lib/validation";
import { toActionError } from "./shared";

const userId = z.uuid();

export async function setUserRoleAction(targetId: string, role: Role): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (!userId.safeParse(targetId).success || (role !== "ADMIN" && role !== "SUBMITTER")) {
      return { ok: false, error: "Invalid request." };
    }
    // Postgres refuses to demote or disable the last active admin.
    await repo.setUserRole(targetId, role);
    revalidatePath("/", "layout");
    return { ok: true, message: `Role changed to ${role === "ADMIN" ? "Admin" : "Submitter"}.` };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function setUserActiveAction(targetId: string, active: boolean): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (!userId.safeParse(targetId).success) return { ok: false, error: "Invalid request." };
    await repo.setUserActive(targetId, active);

    // Also block sign-in at the auth layer when a service key is configured.
    // Data access is already cut off by RLS through the profile flag.
    const service = getBackendMode() === "supabase" ? createSupabaseServiceClient() : null;
    if (service) {
      const { error } = await service.auth.admin.updateUserById(targetId, { ban_duration: active ? "none" : "876000h" });
      if (error) console.error("[users] auth ban update failed");
    }
    revalidatePath("/", "layout");
    return { ok: true, message: active ? "User enabled." : "User disabled. They can no longer sign in or see any data." };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export interface SettingsFormState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export async function updateProfileAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  try {
    await assertUser();
    const parsed = profileSchema.safeParse({ fullName: formData.get("fullName") });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    await repo.updateMyProfile(parsed.data.fullName);
    revalidatePath("/", "layout");
    return { ok: true, message: "Profile updated." };
  } catch (error) {
    return { error: toActionError(error) };
  }
}

export async function changePasswordAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  try {
    const user = await assertUser();
    const limit = rateLimit(`password:${user.id}`, 5, 15 * 60 * 1000);
    if (!limit.ok) return { error: tooManyAttempts(limit) };

    const parsed = changePasswordSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
    const { currentPassword, newPassword } = parsed.data;

    if (getBackendMode() === "supabase") {
      const supabase = await createSupabaseServerClient();
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (verifyError) return { fieldErrors: { currentPassword: ["Current password is incorrect"] } };
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { error: "Could not update the password. Try a different one." };
    } else {
      const db = await getDemoDb();
      const authUser = await findAuthUserByEmail(db, user.email);
      if (!authUser || !verifyPassword(currentPassword, authUser.encrypted_password)) {
        return { fieldErrors: { currentPassword: ["Current password is incorrect"] } };
      }
      await db.query(`update auth.users set encrypted_password = $2, updated_at = now() where id = $1`, [authUser.id, hashPassword(newPassword)]);
    }
    return { ok: true, message: "Password changed." };
  } catch (error) {
    return { error: toActionError(error) };
  }
}

export async function markNotificationsReadAction(ids?: number[]): Promise<ActionResult> {
  try {
    await assertUser();
    const parsed = z.array(z.number().int().positive()).max(100).optional().safeParse(ids);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    await repo.markNotificationsRead(parsed.data);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
