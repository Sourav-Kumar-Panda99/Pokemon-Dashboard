// Database security test-suite.
//
// Spins up an in-memory Postgres (PGlite), applies the real Supabase migrations
// and verifies authorisation rules, RLS and the account workflow end-to-end.
//
//   npm run test:db

import assert from "node:assert/strict";
import path from "node:path";
import { encryptSecret, generateEncryptionKey, parseEncryptionKey, decryptSecret } from "../src/lib/crypto/credentials.ts";
import {
  callAsUser,
  createAuthUser,
  openLocalDatabase,
  queryAsUser,
  seedLocalDatabase,
  type LocalDb,
} from "../src/lib/local-db/index.ts";

const key = parseEncryptionKey(generateEncryptionKey());
const enc = (value: string) => encryptSecret(value, key);

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

async function rejects(promise: Promise<unknown>, pattern: RegExp | string) {
  try {
    await promise;
  } catch (error) {
    const message = `${(error as { code?: string }).code ?? ""} ${(error as Error).message}`;
    if (typeof pattern === "string" ? message.includes(pattern) : pattern.test(message)) return;
    throw new Error(`Rejected with unexpected error: ${message}`);
  }
  throw new Error("Expected the call to be rejected");
}

type ListResult = { total: number; rows: Array<Record<string, unknown>> };

async function main() {
  const { db } = await openLocalDatabase({ projectRoot: path.resolve(import.meta.dirname, "..") });
  const rpc = <T,>(userId: string | null, fn: string, args: Record<string, unknown> = {}) => callAsUser<T>(db, userId, fn, args);

  const admin = await createAuthUser(db, { email: "boss@example.com", password: "x", fullName: "Boss" });
  const riley = await createAuthUser(db, { email: "riley@example.com", password: "x", fullName: "Riley" });
  const sam = await createAuthUser(db, { email: "sam@example.com", password: "x", fullName: "Sam" });
  await db.query(`update public.profiles set role = 'ADMIN' where id = $1`, [admin]);

  console.log("Registration");
  await test("new users get a SUBMITTER profile", async () => {
    const profile = await rpc<{ role: string; full_name: string }>(riley, "get_my_profile");
    assert.equal(profile.role, "SUBMITTER");
    assert.equal(profile.full_name, "Riley");
  });

  console.log("Submissions");
  let rileyAccount = 0;
  let samAccount = 0;
  let adminAccount = 0;
  await test("submitter can submit an account (PENDING)", async () => {
    rileyAccount = await rpc<number>(riley, "submit_account", {
      p_type: "NEW",
      p_login_email: "Riley.Trainer@Example.com",
      p_login_password_enc: enc("pw-1"),
      p_ptc_login: "riley_ptc",
      p_ptc_password_enc: enc("ptc-1"),
      p_notes: "first",
      p_asking_price: 25,
    });
    samAccount = await rpc<number>(sam, "submit_account", {
      p_type: "BOT",
      p_login_email: "sam.trainer@example.com",
      p_login_password_enc: enc("pw-2"),
    });
    const detail = await rpc<{ status: string; login_email: string }>(riley, "get_account_detail", { p_account_id: rileyAccount });
    assert.equal(detail.status, "PENDING");
    assert.equal(detail.login_email, "riley.trainer@example.com");
  });
  await test("plaintext passwords are refused by the database", async () => {
    await rejects(rpc(riley, "submit_account", { p_type: "NEW", p_login_email: "x@example.com", p_login_password_enc: "hunter2", p_asking_price: 5 }), "encrypted");
  });
  await test("duplicate login emails are refused", async () => {
    await rejects(rpc(sam, "submit_account", { p_type: "NEW", p_login_email: "riley.trainer@example.com", p_login_password_enc: enc("a"), p_asking_price: 5 }), "already exists");
  });
  await test("PTC login without password is refused", async () => {
    await rejects(rpc(sam, "submit_account", { p_type: "NEW", p_login_email: "y@example.com", p_login_password_enc: enc("a"), p_ptc_login: "only_login", p_asking_price: 5 }), "PTC password");
  });
  await test("every new account starts as Pending (auto-approve no longer exists)", async () => {
    adminAccount = await rpc<number>(admin, "submit_account", { p_type: "OLD", p_login_email: "admin.add@example.com", p_login_password_enc: enc("pw-3"), p_auto_approve: true });
    const detail = await rpc<{ status: string }>(admin, "get_account_detail", { p_account_id: adminAccount });
    assert.equal(detail.status, "PENDING");
  });

  await test("NEW IDs need an asking price from submitters; other types never keep one", async () => {
    await rejects(rpc(sam, "submit_account", { p_type: "NEW", p_login_email: "noprice@example.com", p_login_password_enc: enc("a") }), "asking price");
    await rejects(rpc(sam, "submit_account", { p_type: "NEW", p_login_email: "neg@example.com", p_login_password_enc: enc("a"), p_asking_price: -1 }), "valid asking price");
    const detail = await rpc<{ asking_price: number }>(riley, "get_account_detail", { p_account_id: rileyAccount });
    assert.equal(Number(detail.asking_price), 25);
    const bot = await rpc<number>(sam, "submit_account", { p_type: "BOT", p_login_email: "botprice@example.com", p_login_password_enc: enc("a"), p_asking_price: 99 });
    assert.equal((await rpc<{ asking_price: number | null }>(sam, "get_account_detail", { p_account_id: bot })).asking_price, null);
    const adminNew = await rpc<number>(admin, "submit_account", { p_type: "NEW", p_login_email: "adminnew@example.com", p_login_password_enc: enc("a") });
    assert.equal((await rpc<{ asking_price: number | null }>(admin, "get_account_detail", { p_account_id: adminNew })).asking_price, null);
    await rpc(admin, "delete_accounts", { p_account_ids: [bot, adminNew] });
  });

  console.log("Row Level Security");
  await test("submitters only list their own accounts", async () => {
    const mine = await rpc<ListResult>(riley, "list_accounts");
    assert.equal(mine.total, 1);
    assert.equal(mine.rows[0].id, rileyAccount);
    const all = await rpc<ListResult>(admin, "list_accounts");
    assert.equal(all.total, 3);
  });
  await test("submitters cannot read another user's account detail", async () => {
    assert.equal(await rpc(riley, "get_account_detail", { p_account_id: samAccount }), null);
  });
  await test("submitters see only their own rows on direct table reads", async () => {
    const rows = await queryAsUser<{ id: number }>(db, riley, `select id from public.accounts`);
    assert.deepEqual(rows.map((r) => Number(r.id)), [rileyAccount]);
    const profiles = await queryAsUser<{ id: string }>(db, riley, `select id from public.profiles`);
    assert.deepEqual(profiles.map((p) => p.id), [riley]);
  });
  await test("password ciphertext is not selectable by API roles — even admins", async () => {
    await rejects(queryAsUser(db, admin, `select login_password_enc from public.account_credentials`), "permission denied");
    await rejects(queryAsUser(db, riley, `select ptc_password_enc from public.account_credentials`), "permission denied");
    const ok = await queryAsUser<{ login_email: string }>(db, riley, `select login_email from public.account_credentials`);
    assert.equal(ok.length, 1);
  });
  await test("direct writes are blocked for every API role", async () => {
    await rejects(queryAsUser(db, riley, `update public.profiles set role = 'ADMIN' where id = '${riley}'`), "permission denied");
    await rejects(queryAsUser(db, admin, `delete from public.account_activity`), "permission denied");
    await rejects(queryAsUser(db, riley, `insert into public.accounts (type) values ('NEW')`), "permission denied");
    await rejects(queryAsUser(db, admin, `update public.accounts set status = 'SOLD'`), "permission denied");
  });
  await test("anonymous callers get nothing", async () => {
    await rejects(queryAsUser(db, null, `select * from public.accounts`), "permission denied");
    await rejects(rpc(null, "list_accounts"), "permission denied");
  });

  console.log("Admin-only operations");
  await test("submitters cannot approve, sell, export or read logs", async () => {
    await rejects(rpc(riley, "set_account_status", { p_account_ids: [rileyAccount], p_action: "MARK_SOLD", p_price: 1 }), "Admin access required");
    await rejects(rpc(riley, "admin_get_account_secret", { p_account_id: rileyAccount, p_field: "login_password" }), "Admin access required");
    await rejects(rpc(riley, "admin_export_accounts", { p_account_ids: [rileyAccount], p_include_secrets: true }), "Admin access required");
    await rejects(rpc(riley, "list_activity"), "Admin access required");
    await rejects(rpc(riley, "list_users"), "Admin access required");
    await rejects(rpc(riley, "sales_overview"), "Admin access required");
    await rejects(rpc(riley, "admin_set_user_role", { p_user_id: riley, p_role: "ADMIN" }), "Admin access required");
  });
  await test("submitters cannot edit or delete someone else's account", async () => {
    await rejects(rpc(riley, "update_account", { p_account_id: samAccount, p_type: "OLD", p_login_email: "x@example.com" }), "Account not found");
    await rejects(rpc(riley, "delete_accounts", { p_account_ids: [samAccount] }), "No accounts could be deleted");
  });
  await test("submitter can change the asking price of a pending NEW ID (logged)", async () => {
    await rpc(riley, "update_account", { p_account_id: rileyAccount, p_type: "NEW", p_login_email: "riley.trainer@example.com", p_ptc_login: "riley_ptc", p_notes: "first", p_asking_price: 30 });
    const detail = await rpc<{ asking_price: number; activity: Array<{ action: string; details: { fields?: string[] } }> }>(riley, "get_account_detail", { p_account_id: rileyAccount });
    assert.equal(Number(detail.asking_price), 30);
    assert.ok(detail.activity.some((e) => e.action === "EDITED" && e.details.fields?.includes("asking_price")));
    await rejects(rpc(riley, "update_account", { p_account_id: rileyAccount, p_type: "NEW", p_login_email: "riley.trainer@example.com", p_ptc_login: "riley_ptc" }), "asking price");
  });
  await test("submitter can edit own pending submission (password kept when omitted)", async () => {
    await rpc(riley, "update_account", { p_account_id: rileyAccount, p_type: "BOT", p_login_email: "riley.trainer@example.com", p_ptc_login: "riley_ptc", p_notes: "updated" });
    const secret = await rpc<string>(admin, "admin_get_account_secret", { p_account_id: rileyAccount, p_field: "ptc_password" });
    assert.equal(decryptSecret(secret, key), "ptc-1");
  });
  await test("submitters cannot change status through update_account", async () => {
    await rejects(rpc(riley, "update_account", { p_account_id: rileyAccount, p_type: "BOT", p_login_email: "riley.trainer@example.com", p_ptc_login: "riley_ptc", p_status: "SOLD" }), "Only admins");
  });

  console.log("Workflow");
  await test("mark sold → SOLD with price, notifies submitter, locks submitter edits", async () => {
    const result = await rpc<{ updated: number }>(admin, "set_account_status", { p_account_ids: [rileyAccount], p_action: "MARK_SOLD", p_price: 19.5 });
    assert.equal(result.updated, 1);
    const detail = await rpc<{ status: string; sold_by_name: string | null; sale_price: number | null }>(riley, "get_account_detail", { p_account_id: rileyAccount });
    assert.equal(detail.status, "SOLD");
    assert.equal(detail.sold_by_name, null, "admin identity is hidden from submitters by RLS");
    assert.equal(detail.sale_price, null, "sale prices are admin-only");
    await rejects(rpc(riley, "update_account", { p_account_id: rileyAccount, p_type: "NEW", p_login_email: "riley.trainer@example.com" }), "Only pending");
    await rejects(rpc(riley, "delete_accounts", { p_account_ids: [rileyAccount] }), "No accounts could be deleted");
  });
  await test("moving a sold account back to Pending voids the sale; selling again records a new one", async () => {
    await rpc(admin, "update_account", { p_account_id: rileyAccount, p_type: "BOT", p_login_email: "riley.trainer@example.com", p_ptc_login: "riley_ptc", p_notes: "updated", p_status: "PENDING" });
    let sales = await queryAsUser(db, admin, `select 1 from public.sales where account_id = ${rileyAccount} and voided_at is null`);
    assert.equal(sales.length, 0);
    await rpc(admin, "set_account_status", { p_account_ids: [rileyAccount], p_action: "MARK_SOLD", p_price: 20 });
    sales = await queryAsUser(db, admin, `select 1 from public.sales where account_id = ${rileyAccount} and voided_at is null`);
    assert.equal(sales.length, 1);
    const stats = await rpc<{ sold: number; pending: number; rejected: number }>(admin, "account_stats");
    assert.deepEqual([stats.sold, stats.pending, stats.rejected], [1, 2, 0]);
  });
  await test("only Pending accounts can be sold or rejected; Unsold/Approved are gone", async () => {
    const result = await rpc<{ updated: number; skipped: number }>(admin, "set_account_status", { p_account_ids: [rileyAccount], p_action: "MARK_SOLD", p_price: 1 });
    assert.deepEqual(result, { updated: 0, skipped: 1 });
    await rejects(rpc(admin, "set_account_status", { p_account_ids: [samAccount], p_action: "APPROVE" }), "Unknown action");
    await rejects(rpc(admin, "set_account_status", { p_account_ids: [samAccount], p_action: "MARK_UNSOLD" }), "Unknown action");
    await rejects(rpc(admin, "update_account", { p_account_id: samAccount, p_type: "BOT", p_login_email: "sam.trainer@example.com", p_status: "UNSOLD" }), "no longer used");
    await rejects(db.query(`update public.accounts set status = 'APPROVED' where id = $1`, [samAccount]), "accounts_status_simplified");
  });
  await test("pending accounts can be sold directly, with the sold price recorded", async () => {
    const direct = await rpc<number>(sam, "submit_account", { p_type: "OLD", p_login_email: "direct.sale@example.com", p_login_password_enc: enc("a") });
    const result = await rpc<{ updated: number }>(admin, "set_account_status", { p_account_ids: [direct], p_action: "MARK_SOLD", p_price: 42 });
    assert.equal(result.updated, 1);
    let detail = await rpc<{ status: string; sale_price: number }>(admin, "get_account_detail", { p_account_id: direct });
    assert.deepEqual([detail.status, Number(detail.sale_price)], ["SOLD", 42]);
    // correct the sold price from the edit form
    await rpc(admin, "update_account", { p_account_id: direct, p_type: "OLD", p_login_email: "direct.sale@example.com", p_status: "SOLD", p_sale_price: 45.5 });
    detail = await rpc(admin, "get_account_detail", { p_account_id: direct });
    assert.equal(Number(detail.sale_price), 45.5);
    // still exactly one active sale record
    const sold = await queryAsUser<{ n: number }>(db, admin, `select count(*)::int as n from public.sales where account_id = ${direct} and voided_at is null`);
    assert.equal(sold[0].n, 1);
    await rpc(admin, "delete_accounts", { p_account_ids: [direct] });
  });
  await test("edit form can move a pending account straight to Sold with a price", async () => {
    const viaEdit = await rpc<number>(sam, "submit_account", { p_type: "BOT", p_login_email: "edit.sale@example.com", p_login_password_enc: enc("a") });
    await rpc(admin, "update_account", { p_account_id: viaEdit, p_type: "BOT", p_login_email: "edit.sale@example.com", p_status: "SOLD", p_sale_price: 12 });
    const detail = await rpc<{ status: string; sale_price: number }>(admin, "get_account_detail", { p_account_id: viaEdit });
    assert.deepEqual([detail.status, Number(detail.sale_price)], ["SOLD", 12]);
    await rpc(admin, "delete_accounts", { p_account_ids: [viaEdit] });
  });
  await test("submitter sees notifications and a sanitised history", async () => {
    const notes = await rpc<{ unread: number; rows: Array<{ kind: string }> }>(riley, "list_notifications");
    assert.ok(notes.unread >= 1 && notes.rows.some((n) => n.kind === "SOLD"));
    const history = await rpc<ListResult>(riley, "list_my_activity");
    const actions = history.rows.map((r) => r.action);
    assert.ok(actions.includes("MARKED_SOLD") && !actions.includes("APPROVED"));
    assert.ok(!actions.includes("CREDENTIALS_REVEALED"), "reveal events stay admin-only");
  });
  await test("credential reveals are audited without the secret", async () => {
    const log = await rpc<ListResult>(admin, "list_activity", { p_action: "CREDENTIALS_REVEALED" });
    assert.ok(log.total >= 1);
    assert.ok(!JSON.stringify(log.rows).includes("v1:"), "logs never contain ciphertext");
  });
  await test("type changes are logged with from/to", async () => {
    await rpc(admin, "set_account_type", { p_account_ids: [samAccount], p_type: "OLD" });
    const log = await rpc<ListResult>(admin, "list_activity", { p_action: "TYPE_CHANGED", p_search: `#${samAccount}` });
    assert.equal((log.rows[0].details as { from: string; to: string }).to, "OLD");
  });

  console.log("Search, filters & pagination");
  await test("search by id, login email, PTC login and submitter", async () => {
    assert.equal((await rpc<ListResult>(admin, "list_accounts", { p_search: `#${samAccount}` })).total, 1);
    assert.equal((await rpc<ListResult>(admin, "list_accounts", { p_search: "RILEY.TRAI" })).total, 1);
    assert.equal((await rpc<ListResult>(admin, "list_accounts", { p_search: "riley_pt" })).total, 1);
    assert.equal((await rpc<ListResult>(admin, "list_accounts", { p_search: "Sam" })).total, 1);
    assert.equal((await rpc<ListResult>(admin, "list_accounts", { p_search: "%" })).total, 0, "wildcards are escaped");
  });
  await test("type / status / submitter filters", async () => {
    assert.equal((await rpc<ListResult>(admin, "list_accounts", { p_type: "OLD" })).total, 2);
    assert.equal((await rpc<ListResult>(admin, "list_accounts", { p_status: "SOLD" })).total, 1);
    assert.equal((await rpc<ListResult>(admin, "list_accounts", { p_submitter_id: sam })).total, 1);
  });

  console.log("User management");
  await test("the last active admin can never be removed", async () => {
    await rejects(rpc(admin, "admin_set_user_role", { p_user_id: admin, p_role: "SUBMITTER" }), "At least one active admin");
    await rejects(rpc(admin, "admin_set_user_active", { p_user_id: admin, p_active: false }), "cannot disable your own");
    await rejects(db.query(`delete from auth.users where id = $1`, [admin]), "At least one active admin");
  });
  await test("disabled users lose access immediately", async () => {
    await rpc(admin, "admin_set_user_active", { p_user_id: sam, p_active: false });
    assert.equal((await rpc<ListResult>(sam, "list_accounts")).total, 0);
    await rejects(rpc(sam, "submit_account", { p_type: "NEW", p_login_email: "z@example.com", p_login_password_enc: enc("a") }), "disabled");
    await rpc(admin, "admin_set_user_active", { p_user_id: sam, p_active: true });
    assert.equal((await rpc<ListResult>(sam, "list_accounts")).total, 1);
  });
  await test("role changes are logged and take effect", async () => {
    await rpc(admin, "admin_set_user_role", { p_user_id: sam, p_role: "ADMIN" });
    assert.equal((await rpc<ListResult>(sam, "list_accounts")).total, 3);
    await rpc(sam, "admin_set_user_role", { p_user_id: sam, p_role: "SUBMITTER" });
    const users = await rpc<{ active_admins: number }>(admin, "list_users");
    assert.equal(users.active_admins, 1);
  });

  console.log("Import / export");
  await test("import validates rows and skips duplicates", async () => {
    const result = await rpc<{ inserted: number; failed: number; errors: Array<{ row: number; message: string }> }>(admin, "admin_import_accounts", {
      p_rows: [
        { type: "BOT", login_email: "import1@example.com", login_password_enc: enc("a") },
        { type: "NEW", login_email: "riley.trainer@example.com", login_password_enc: enc("b") },
        { type: "OLD", login_email: "bad-email", login_password_enc: enc("c") },
        { type: "NEW", login_email: "plain@example.com", login_password_enc: "not-encrypted" },
      ],
    });
    assert.equal(result.inserted, 1);
    assert.equal(result.failed, 3);
    assert.deepEqual(result.errors.map((e) => e.row), [2, 3, 4]);
  });
  await test("export with passwords is admin-only and audited", async () => {
    const rows = await rpc<Array<{ login_password_enc?: string }>>(admin, "admin_export_accounts", { p_account_ids: [rileyAccount], p_include_secrets: true });
    assert.equal(decryptSecret(rows[0].login_password_enc!, key), "pw-1");
    const log = await rpc<ListResult>(admin, "list_activity", { p_action: "EXPORTED" });
    assert.equal(log.total, 1);
  });

  console.log("Demo seed");
  await test("seeded inventory matches the spec", async () => {
    const fresh = await openLocalDatabase({ projectRoot: path.resolve(import.meta.dirname, "..") });
    await seedLocalDatabase(fresh.db, { encryptionKey: key, demoPassword: "demo-only" });
    const anAdmin = (await fresh.db.query<{ id: string }>(`select id from public.profiles where role = 'ADMIN' limit 1`)).rows[0].id;
    const stats = await callAsUser<Record<string, number>>(fresh.db as LocalDb, anAdmin, "account_stats");
    assert.equal(stats.total, 250);
    const newIds = await callAsUser<ListResult>(fresh.db, anAdmin, "list_accounts", { p_type: "NEW", p_page_size: 100 });
    assert.ok(newIds.rows.every((r) => Number(r.asking_price) > 0), "seeded NEW IDs carry an asking price");
    assert.deepEqual([stats.new, stats.bot, stats.old], [85, 95, 70]);
    assert.deepEqual([stats.sold, stats.pending, stats.rejected], [70, 175, 5]);
    const page = await callAsUser<ListResult>(fresh.db, anAdmin, "list_accounts", { p_page: 13, p_page_size: 20 });
    assert.equal(page.rows.length, 10);
    await fresh.db.close();
  });

  await db.close();
  console.log(`\n${passed} database checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
