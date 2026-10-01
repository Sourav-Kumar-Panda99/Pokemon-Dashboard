import "server-only";
import { DbError, userMessage } from "@/lib/server/db";
import { AuthorizationError } from "@/lib/server/session";

/** Converts any thrown error into a message that is safe to show users. */
export function toActionError(error: unknown): string {
  if (error instanceof AuthorizationError) return error.message;
  if (error instanceof DbError) return userMessage(error);
  console.error("[action] unexpected error:", error instanceof Error ? error.name : "unknown");
  return "Something went wrong. Please try again.";
}

/** Only allow same-site, in-app redirect targets. */
export function safeNext(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (!/^\/(admin|dashboard)(\/|\?|$)/.test(value)) return null;
  return value;
}
