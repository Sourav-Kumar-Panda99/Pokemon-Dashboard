import "server-only";
import { getBackendMode } from "@/lib/backend";
import { callAsUser } from "@/lib/local-db";
import { getDemoDb, readDemoSession } from "./demo";
import { createSupabaseServerClient } from "./supabase";

export class DbError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "DbError";
  }
}

// Codes raised deliberately by our SQL functions — their messages are written
// for end users and never contain secrets.
const USER_FACING_CODES = new Set(["P0001", "P0002", "42501", "28000"]);

export function userMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof DbError && USER_FACING_CODES.has(error.code)) return error.message;
  return fallback;
}

/**
 * Calls a database function as the signed-in user. Authorisation is enforced
 * inside Postgres (RLS + role checks), on top of the checks in server actions.
 * Arguments are never logged — they can contain credential ciphertext.
 */
export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const mode = getBackendMode();
  const cleanArgs = Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));

  if (mode === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(fn, cleanArgs);
    if (error) {
      if (!USER_FACING_CODES.has(error.code)) console.error(`[db] ${fn} failed (${error.code})`);
      throw new DbError(error.code || "XX000", error.message);
    }
    return data as T;
  }

  if (mode === "demo") {
    const session = await readDemoSession();
    const db = await getDemoDb();
    try {
      return await callAsUser<T>(db, session?.userId ?? null, fn, cleanArgs);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      if (!USER_FACING_CODES.has(err.code ?? "")) console.error(`[db] ${fn} failed (${err.code ?? "unknown"})`);
      throw new DbError(err.code ?? "XX000", err.message ?? "Database error");
    }
  }

  throw new DbError("NOCFG", "The backend is not configured");
}
