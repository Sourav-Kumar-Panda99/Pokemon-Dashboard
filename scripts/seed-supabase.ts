// Seeds a Supabase project with FICTIONAL demo data (250 accounts, 10 users).
//
//   npm run db:seed            # refuses if accounts already exist
//   npm run db:seed -- --force # seed anyway (adds to existing data)
//
// Requires (in .env.local or the environment):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CREDENTIALS_ENCRYPTION_KEY
// Optional: SEED_DEMO_PASSWORD (password for every demo login)

import { createClient } from "@supabase/supabase-js";
import { encryptSecret, parseEncryptionKey } from "../src/lib/crypto/credentials.ts";
import { generateDemoData } from "../src/lib/demo/generate.ts";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const rawKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
const demoPassword = process.env.SEED_DEMO_PASSWORD || "go-demo-2026";
const force = process.argv.includes("--force");

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!url || !serviceKey) fail("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
if (!rawKey) fail("CREDENTIALS_ENCRYPTION_KEY is required (generate one with `npm run gen:key`).");

const key = parseEncryptionKey(rawKey);
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function must<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await promise;
  if (error) fail(`${what}: ${error.message}`);
  return data;
}

async function findUserId(email: string): Promise<string | null> {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`listing users: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  const { count } = await supabase.from("accounts").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0 && !force) fail(`The accounts table already has ${count} rows. Re-run with --force to add demo data anyway.`);

  const data = generateDemoData();
  const userIds = new Map<string, string>();

  console.log("→ Creating demo users");
  for (const user of data.users) {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    });
    const id = created?.user?.id ?? (error ? await findUserId(user.email) : null);
    if (!id) fail(`creating ${user.email}: ${error?.message ?? "unknown error"}`);
    userIds.set(user.key, id);
  }

  // Admins first so the "last active admin" guard never trips.
  for (const user of [...data.users].sort((a, b) => Number(b.role === "ADMIN") - Number(a.role === "ADMIN"))) {
    await must(
      supabase
        .from("profiles")
        .update({ role: user.role, is_active: user.isActive, full_name: user.fullName, created_at: user.createdAt.toISOString() })
        .eq("id", userIds.get(user.key)!),
      `updating profile ${user.email}`,
    );
    if (!user.isActive) await supabase.auth.admin.updateUserById(userIds.get(user.key)!, { ban_duration: "876000h" });
  }

  console.log("→ Inserting 250 fictional accounts");
  const accountIds: number[] = [];
  for (let start = 0; start < data.accounts.length; start += 100) {
    const batch = data.accounts.slice(start, start + 100);
    const rows = await must(
      supabase
        .from("accounts")
        .insert(
          batch.map((a) => ({
            submitter_id: userIds.get(a.submitterKey),
            type: a.type,
            status: a.status,
            notes: a.notes,
            asking_price: a.askingPrice,
            created_at: a.createdAt.toISOString(),
            updated_at: a.updatedAt.toISOString(),
            approved_at: a.approvedAt?.toISOString() ?? null,
            approved_by: a.approvedByKey ? userIds.get(a.approvedByKey) : null,
            rejected_at: a.rejectedAt?.toISOString() ?? null,
            rejected_by: a.rejectedByKey ? userIds.get(a.rejectedByKey) : null,
            sold_at: a.soldAt?.toISOString() ?? null,
            sold_by: a.soldByKey ? userIds.get(a.soldByKey) : null,
          })),
        )
        .select("id, created_at"),
      "inserting accounts",
    );
    // Map returned ids back by creation time (unique per generated account).
    const byTime = new Map((rows ?? []).map((r: { id: number; created_at: string }) => [new Date(r.created_at).getTime(), r.id]));
    for (const a of batch) {
      const id = byTime.get(a.createdAt.getTime());
      if (!id) fail("could not map inserted account ids");
      accountIds.push(id);
    }
  }

  await must(
    supabase.from("account_credentials").insert(
      data.accounts.map((a, i) => ({
        account_id: accountIds[i],
        login_email: a.loginEmail,
        login_password_enc: encryptSecret(a.loginPassword, key),
        ptc_login: a.ptcLogin,
        ptc_password_enc: a.ptcPassword ? encryptSecret(a.ptcPassword, key) : null,
        created_at: a.createdAt.toISOString(),
        updated_at: a.createdAt.toISOString(),
      })),
    ),
    "inserting credentials",
  );

  console.log("→ Writing activity, sales and notifications");
  const events = data.accounts.flatMap((a, i) =>
    a.events.map((e) => ({
      account_id: accountIds[i],
      account_ref: accountIds[i],
      actor_id: userIds.get(e.actorKey),
      action: e.action,
      details: e.details,
      created_at: e.at.toISOString(),
    })),
  );
  for (let start = 0; start < events.length; start += 500) {
    await must(supabase.from("account_activity").insert(events.slice(start, start + 500)), "inserting activity");
  }
  await must(
    supabase.from("account_activity").insert(
      data.globalEvents.map((e) => ({
        actor_id: userIds.get(e.actorKey),
        target_user_id: e.targetKey ? userIds.get(e.targetKey) : null,
        action: e.action,
        details: e.details,
        created_at: e.at.toISOString(),
      })),
    ),
    "inserting audit events",
  );
  await must(
    supabase.from("sales").insert(
      data.accounts.flatMap((a, i) =>
        a.soldAt ? [{ account_id: accountIds[i], sold_by: a.soldByKey ? userIds.get(a.soldByKey) : null, sold_at: a.soldAt.toISOString(), price: a.salePrice }] : [],
      ),
    ),
    "inserting sales",
  );
  if (data.notifications.length) {
    await must(
      supabase.from("notifications").insert(
        data.notifications.map((n) => ({
          user_id: userIds.get(n.userKey),
          account_id: accountIds[n.accountIndex],
          kind: n.kind,
          title: n.title.replace(/#\d+/, `#${String(accountIds[n.accountIndex]).padStart(3, "0")}`),
          body: n.body,
          read_at: n.read ? n.createdAt.toISOString() : null,
          created_at: n.createdAt.toISOString(),
        })),
      ),
      "inserting notifications",
    );
  }

  console.log(`\n✓ Seeded ${data.users.length} users and ${data.accounts.length} accounts.`);
  console.log(`  Admin login:     admin@example.com`);
  console.log(`  Submitter login: submitter@example.com`);
  console.log(`  Password:        the value of SEED_DEMO_PASSWORD (default documented in README)\n`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
