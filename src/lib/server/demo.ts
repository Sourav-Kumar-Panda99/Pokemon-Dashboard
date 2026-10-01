import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { DEMO_SESSION_COOKIE, REMEMBER_COOKIE, hardenCookieOptions } from "@/lib/backend";
import { generateEncryptionKey, parseEncryptionKey } from "@/lib/crypto/credentials";
import { openLocalDatabase, seedLocalDatabase, type LocalDb } from "@/lib/local-db";

// Offline demo backend: an embedded Postgres (PGlite) running the real
// Supabase migrations, plus a signed-cookie session. Never used when
// Supabase is configured.

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SHORT_SESSION_TTL_SECONDS = 60 * 60 * 12;

function dataDir() {
  return process.env.DEMO_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ".data");
}

function readOrCreateSecretFile(fileName: string, create: () => string): string {
  const dir = dataDir();
  const file = path.join(/*turbopackIgnore: true*/ dir, fileName);
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  mkdirSync(dir, { recursive: true });
  const value = create();
  writeFileSync(file, value, { mode: 0o600 });
  return value;
}

/** Demo data is encrypted with its own key, stored next to the demo database. */
export function getDemoEncryptionKey(): Buffer {
  return parseEncryptionKey(readOrCreateSecretFile("demo-encryption.key", generateEncryptionKey));
}

function sessionSecret(): Buffer {
  const fromEnv = process.env.DEMO_SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) return Buffer.from(fromEnv);
  return Buffer.from(readOrCreateSecretFile("demo-session.secret", () => randomBytes(48).toString("base64url")));
}

export function getDemoPassword() {
  return process.env.DEMO_PASSWORD || "go-demo-2026";
}

const globalForDemo = globalThis as typeof globalThis & { __gamDemoDb?: Promise<LocalDb> };

export function getDemoDb(): Promise<LocalDb> {
  if (!globalForDemo.__gamDemoDb) {
    globalForDemo.__gamDemoDb = (async () => {
      const { db } = await openLocalDatabase({
        projectRoot: /*turbopackIgnore: true*/ process.cwd(),
        dataDir: path.join(/*turbopackIgnore: true*/ dataDir(), "demo-db"),
      });
      const users = await db.query<{ n: number }>(`select count(*)::int as n from auth.users`);
      if (Number(users.rows[0]?.n ?? 0) === 0) {
        await seedLocalDatabase(db, { encryptionKey: getDemoEncryptionKey(), demoPassword: getDemoPassword() });
      }
      return db;
    })().catch((error) => {
      globalForDemo.__gamDemoDb = undefined;
      throw error;
    });
  }
  return globalForDemo.__gamDemoDb;
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export async function createDemoSession(userId: string, remember: boolean) {
  const ttl = remember ? SESSION_TTL_SECONDS : SHORT_SESSION_TTL_SECONDS;
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const payload = `${userId}.${expires}`;
  const store = await cookies();
  const value = `${payload}.${sign(payload)}`;
  store.set(DEMO_SESSION_COOKIE, value, hardenCookieOptions({ maxAge: ttl }, value, remember));
  store.set(REMEMBER_COOKIE, remember ? "1" : "0", hardenCookieOptions({ maxAge: SESSION_TTL_SECONDS }, "x", true));
}

export async function readDemoSession(): Promise<{ userId: string } | null> {
  const store = await cookies();
  const raw = store.get(DEMO_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [userId, expires, signature] = raw.split(".");
  if (!userId || !expires || !signature || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  if (Number(expires) * 1000 < Date.now()) return null;
  const expected = Buffer.from(sign(`${userId}.${expires}`));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return { userId };
}

export async function clearDemoSession() {
  const store = await cookies();
  store.delete(DEMO_SESSION_COOKIE);
}
