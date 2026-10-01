// Embedded Postgres (PGlite) used by the offline demo mode and the database
// test-suite. It runs the exact same Supabase migrations, so RLS policies and
// the RPC functions behave identically to production.
//
// Kept free of Next.js / path-alias imports so scripts can import it directly.

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { encryptSecret } from "../crypto/credentials.ts";
import { generateDemoData } from "../demo/generate.ts";

export type LocalDb = PGlite;

export class LocalDbError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function openLocalDatabase(options: { projectRoot: string; dataDir?: string }) {
  const { projectRoot, dataDir } = options;
  if (dataDir && !dataDir.startsWith("memory://")) mkdirSync(dataDir, { recursive: true });
  const db = await PGlite.create({ dataDir, extensions: { pg_trgm } });
  const probe = await db.query<{ ready: boolean }>(`select to_regclass('public.accounts') is not null as ready`);
  const fresh = !probe.rows[0]?.ready;
  if (fresh) {
    await db.exec(readFileSync(path.join(/*turbopackIgnore: true*/ projectRoot, "supabase", "dev", "pglite-shim.sql"), "utf8"));
    const migrationsDir = path.join(/*turbopackIgnore: true*/ projectRoot, "supabase", "migrations");
    for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
      await db.exec(readFileSync(path.join(/*turbopackIgnore: true*/ migrationsDir, file), "utf8"));
    }
  }
  return { db, fresh };
}

function serializeArg(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  // Arrays of objects map to jsonb parameters, arrays of scalars to Postgres arrays.
  if (Array.isArray(value) && value.some((item) => item !== null && typeof item === "object")) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "number" && !(typeof item === "string" && /^[0-9a-fA-F-]+$/.test(item))) {
        throw new Error("Unsupported array argument");
      }
    }
    return `{${value.join(",")}}`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalize(value: unknown): unknown {
  return typeof value === "bigint" ? Number(value) : value;
}

/**
 * Calls a public RPC function the same way PostgREST does: inside a
 * transaction, as the `authenticated` (or `anon`) role, with JWT claims set.
 */
export async function callAsUser<T>(db: LocalDb, userId: string | null, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!/^[a-z_][a-z0-9_]*$/.test(fn)) throw new Error("Invalid function name");
  const keys = Object.keys(args).filter((key) => args[key] !== undefined);
  for (const key of keys) if (!/^p_[a-z0-9_]+$/.test(key)) throw new Error("Invalid argument name");
  const values = keys.map((key) => serializeArg(args[key]));
  const sql = `select public.${fn}(${keys.map((key, i) => `${key} => $${i + 1}`).join(", ")}) as result`;
  try {
    return await db.transaction(async (tx) => {
      await tx.query(`select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)`, [
        userId ? "authenticated" : "anon",
        JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "anon" }),
      ]);
      const result = await tx.query<{ result: unknown }>(sql, values);
      return normalize(result.rows[0]?.result) as T;
    });
  } catch (error) {
    const err = error as { code?: string; message?: string };
    throw new LocalDbError(err.code ?? "XX000", err.message ?? "Database error");
  }
}

/** Runs arbitrary SQL as an authenticated user (used by the test-suite). */
export async function queryAsUser<T>(db: LocalDb, userId: string | null, sql: string, params: unknown[] = []) {
  try {
    return await db.transaction(async (tx) => {
      await tx.query(`select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)`, [
        userId ? "authenticated" : "anon",
        JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "anon" }),
      ]);
      return (await tx.query<T>(sql, params)).rows;
    });
  } catch (error) {
    const err = error as { code?: string; message?: string };
    throw new LocalDbError(err.code ?? "XX000", err.message ?? "Database error");
  }
}

// --- Local demo authentication -------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  const [scheme, salt, hash] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    // Burn comparable time so unknown users are not distinguishable by timing.
    scryptSync(password, "timing-equaliser", 32, { N: 16384, r: 8, p: 1 });
    return false;
  }
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(password, Buffer.from(salt, "base64url"), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(expected, actual);
}

export async function findAuthUserByEmail(db: LocalDb, email: string) {
  const result = await db.query<{ id: string; encrypted_password: string | null }>(
    `select id, encrypted_password from auth.users where lower(email) = lower($1)`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function createAuthUser(db: LocalDb, input: { email: string; password: string; fullName: string }) {
  const result = await db.query<{ id: string }>(
    `insert into auth.users (email, encrypted_password, raw_user_meta_data) values (lower($1), $2, $3) returning id`,
    [input.email, hashPassword(input.password), JSON.stringify({ full_name: input.fullName })],
  );
  return result.rows[0].id;
}

export async function touchLastSignIn(db: LocalDb, userId: string) {
  await db.query(`update auth.users set last_sign_in_at = now() where id = $1`, [userId]);
}

// --- Demo seed -------------------------------------------------------------------

export async function seedLocalDatabase(db: LocalDb, options: { encryptionKey: Buffer; demoPassword: string; now?: Date }) {
  const data = generateDemoData(options.now ?? new Date());
  const passwordHash = hashPassword(options.demoPassword);

  await db.transaction(async (tx) => {
    const userIds = new Map<string, string>();
    for (const user of data.users) {
      const inserted = await tx.query<{ id: string }>(
        `insert into auth.users (email, encrypted_password, raw_user_meta_data, created_at) values ($1, $2, $3, $4) returning id`,
        [user.email, passwordHash, JSON.stringify({ full_name: user.fullName }), user.createdAt.toISOString()],
      );
      userIds.set(user.key, inserted.rows[0].id);
    }
    // Promote admins before disabling anyone so the last-admin guard is happy.
    for (const user of [...data.users].sort((a, b) => Number(b.role === "ADMIN") - Number(a.role === "ADMIN"))) {
      await tx.query(`update public.profiles set role = $2, is_active = $3, created_at = $4 where id = $1`, [
        userIds.get(user.key),
        user.role,
        user.isActive,
        user.createdAt.toISOString(),
      ]);
    }
    await tx.query(
      `update public.account_activity e set created_at = p.created_at
       from public.profiles p where e.target_user_id = p.id and e.action = 'USER_REGISTERED'`,
    );

    const accountIds: number[] = [];
    for (const account of data.accounts) {
      const id = (
        await tx.query<{ id: number }>(
          `insert into public.accounts
             (submitter_id, type, status, notes, created_at, updated_at, approved_at, approved_by, rejected_at, rejected_by, sold_at, sold_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
          [
            userIds.get(account.submitterKey),
            account.type,
            account.status,
            account.notes,
            account.createdAt.toISOString(),
            account.updatedAt.toISOString(),
            account.approvedAt?.toISOString() ?? null,
            account.approvedByKey ? userIds.get(account.approvedByKey) : null,
            account.rejectedAt?.toISOString() ?? null,
            account.rejectedByKey ? userIds.get(account.rejectedByKey) : null,
            account.soldAt?.toISOString() ?? null,
            account.soldByKey ? userIds.get(account.soldByKey) : null,
          ],
        )
      ).rows[0].id;
      accountIds.push(Number(id));

      await tx.query(
        `insert into public.account_credentials (account_id, login_email, login_password_enc, ptc_login, ptc_password_enc, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $6)`,
        [
          id,
          account.loginEmail,
          encryptSecret(account.loginPassword, options.encryptionKey),
          account.ptcLogin,
          account.ptcPassword ? encryptSecret(account.ptcPassword, options.encryptionKey) : null,
          account.createdAt.toISOString(),
        ],
      );

      for (const event of account.events) {
        await tx.query(
          `insert into public.account_activity (account_id, account_ref, actor_id, action, details, created_at)
           values ($1, $1, $2, $3, $4, $5)`,
          [id, userIds.get(event.actorKey), event.action, JSON.stringify(event.details), event.at.toISOString()],
        );
      }

      if (account.soldAt) {
        await tx.query(`insert into public.sales (account_id, sold_by, sold_at, price) values ($1, $2, $3, $4)`, [
          id,
          account.soldByKey ? userIds.get(account.soldByKey) : null,
          account.soldAt.toISOString(),
          account.salePrice,
        ]);
      }
    }

    for (const n of data.notifications) {
      await tx.query(
        `insert into public.notifications (user_id, account_id, kind, title, body, read_at, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userIds.get(n.userKey),
          accountIds[n.accountIndex],
          n.kind,
          n.title.replace(/#\d+/, `#${String(accountIds[n.accountIndex]).padStart(3, "0")}`),
          n.body,
          n.read ? n.createdAt.toISOString() : null,
          n.createdAt.toISOString(),
        ],
      );
    }

    for (const event of data.globalEvents) {
      await tx.query(
        `insert into public.account_activity (actor_id, target_user_id, action, details, created_at) values ($1, $2, $3, $4, $5)`,
        [
          userIds.get(event.actorKey),
          event.targetKey ? userIds.get(event.targetKey) : null,
          event.action,
          JSON.stringify(event.details),
          event.at.toISOString(),
        ],
      );
    }
  });

  return { users: data.users.length, accounts: data.accounts.length };
}
