"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ACCOUNT_TYPES } from "@/lib/constants";
import { IMPORT_COLUMNS, parseCsv, toCsv } from "@/lib/csv";
import { formatAccountId } from "@/lib/format";
import { decryptCredential, encryptCredential } from "@/lib/server/encryption";
import * as repo from "@/lib/server/repo";
import { rateLimit, tooManyAttempts } from "@/lib/server/rate-limit";
import { assertAdmin, assertUser } from "@/lib/server/session";
import type { AccountStatus, AccountType, ActionResult, CredentialField, StatusAction } from "@/lib/types";
import {
  accountCreateSchema,
  accountUpdateSchema,
  emailField,
  fieldErrors,
  formValues,
  idListSchema,
  parseAccountQuery,
  statusActionSchema,
  type SearchParams,
} from "@/lib/validation";
import { toActionError } from "./shared";

export interface AccountFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  accountId?: number;
  status?: AccountStatus;
}

const FORM_KEYS = ["type", "loginEmail", "loginPassword", "ptcLogin", "ptcPassword", "notes", "status", "askingPrice", "salePrice"];
const ASKING_PRICE_REQUIRED = { askingPrice: ["Enter your asking price for this new account"] };

function refreshAll() {
  revalidatePath("/", "layout");
}

export async function createAccountAction(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  try {
    const user = await assertUser();
    const limit = rateLimit(`submit:${user.id}`, 60, 10 * 60 * 1000);
    if (!limit.ok) return { error: tooManyAttempts(limit) };

    const parsed = accountCreateSchema.safeParse(formValues(formData, FORM_KEYS));
    if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const input = parsed.data;
    if (input.type === "NEW" && input.askingPrice === undefined && user.role !== "ADMIN") {
      return { error: "Please fix the highlighted fields.", fieldErrors: ASKING_PRICE_REQUIRED };
    }

    const id = await repo.submitAccount({
      type: input.type,
      loginEmail: input.loginEmail,
      loginPasswordEnc: encryptCredential(input.loginPassword),
      ptcLogin: input.ptcLogin,
      ptcPasswordEnc: input.ptcPassword ? encryptCredential(input.ptcPassword) : undefined,
      notes: input.notes,
      askingPrice: input.type === "NEW" ? input.askingPrice : undefined,
    });
    refreshAll();
    return { ok: true, accountId: id, status: "PENDING" };
  } catch (error) {
    return { error: toActionError(error) };
  }
}

export async function updateAccountAction(accountId: number, _prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  try {
    const user = await assertUser();
    if (!Number.isInteger(accountId) || accountId <= 0) return { error: "Unknown account." };
    const parsed = accountUpdateSchema.safeParse(formValues(formData, FORM_KEYS));
    if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
    const input = parsed.data;
    if (input.type === "NEW" && input.askingPrice === undefined && user.role !== "ADMIN") {
      return { error: "Please fix the highlighted fields.", fieldErrors: ASKING_PRICE_REQUIRED };
    }
    const markingSold = user.role === "ADMIN" && input.status === "SOLD";
    if (markingSold && input.salePrice === undefined) {
      return { error: "Please fix the highlighted fields.", fieldErrors: { salePrice: ["Enter the price you sold it for"] } };
    }

    await repo.updateAccount({
      id: accountId,
      type: input.type,
      loginEmail: input.loginEmail,
      loginPasswordEnc: input.loginPassword ? encryptCredential(input.loginPassword) : undefined,
      ptcLogin: input.ptcLogin,
      ptcPasswordEnc: input.ptcPassword ? encryptCredential(input.ptcPassword) : undefined,
      notes: input.notes,
      status: user.role === "ADMIN" ? input.status : undefined,
      askingPrice: input.type === "NEW" ? input.askingPrice : undefined,
      salePrice: markingSold ? input.salePrice : undefined,
    });
    refreshAll();
    return { ok: true, accountId };
  } catch (error) {
    return { error: toActionError(error) };
  }
}

export async function changeStatusAction(input: {
  ids: number[];
  action: StatusAction;
  price?: number | null;
  reason?: string;
}): Promise<ActionResult<{ updated: number; skipped: number }>> {
  try {
    // Suppliers may mark their own pending accounts as sold; everything else is
    // admin-only. Postgres enforces both rules again (ownership included).
    const user = await assertUser();
    const isAdmin = user.role === "ADMIN";
    const parsed = statusActionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
    const { ids, action, price, reason } = parsed.data;
    if (!isAdmin && action !== "MARK_SOLD") return { ok: false, error: "Admin access required." };
    const result = await repo.setAccountStatus(ids, action, price, isAdmin ? reason : undefined);
    refreshAll();
    const verb = { REJECT: "rejected", MARK_SOLD: "marked as sold" }[action];
    const subject = ids.length === 1 ? `Account ${formatAccountId(ids[0])}` : `${result.updated} account${result.updated === 1 ? "" : "s"}`;
    if (result.updated === 0) return { ok: false, error: "That change is not allowed for the selected status." };
    const followUp = !isAdmin && action === "MARK_SOLD" ? " An admin will approve the sale for the records." : "";
    return {
      ok: true,
      data: result,
      message: `${subject} ${verb}.${followUp}${result.skipped ? ` ${result.skipped} skipped (status not eligible).` : ""}`,
    };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Admin-only: approve sales that suppliers recorded. Nothing about the sale itself changes. */
export async function approveSalesAction(ids: number[]): Promise<ActionResult<{ updated: number; skipped: number }>> {
  try {
    await assertAdmin();
    const parsed = idListSchema.safeParse(ids);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const result = await repo.approveSales(parsed.data);
    refreshAll();
    if (result.updated === 0) return { ok: false, error: "No sale is waiting for approval in this selection." };
    const subject = parsed.data.length === 1 ? `Sale of ${formatAccountId(parsed.data[0])}` : `${result.updated} sale${result.updated === 1 ? "" : "s"}`;
    return {
      ok: true,
      data: result,
      message: `${subject} approved.${result.skipped ? ` ${result.skipped} skipped (nothing to approve).` : ""}`,
    };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function changeTypeAction(ids: number[], type: AccountType): Promise<ActionResult<{ updated: number }>> {
  try {
    await assertAdmin();
    const parsedIds = idListSchema.safeParse(ids);
    if (!parsedIds.success || !ACCOUNT_TYPES.includes(type)) return { ok: false, error: "Invalid request." };
    const result = await repo.setAccountType(parsedIds.data, type);
    refreshAll();
    return { ok: true, data: result, message: `${result.updated} account${result.updated === 1 ? "" : "s"} changed to ${type} ID.` };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteAccountsAction(ids: number[]): Promise<ActionResult<{ deleted: number }>> {
  try {
    // Submitters may only withdraw their own pending submissions — enforced in Postgres.
    await assertUser();
    const parsed = idListSchema.safeParse(ids);
    if (!parsed.success) return { ok: false, error: "Invalid request." };
    const result = await repo.deleteAccounts(parsed.data);
    refreshAll();
    return {
      ok: true,
      data: result,
      message: result.deleted === 1 ? "Account deleted permanently." : `${result.deleted} accounts deleted permanently.`,
    };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/** Admin-only, audited, rate-limited decryption of ONE credential. */
export async function revealCredentialAction(accountId: number, field: CredentialField): Promise<ActionResult<{ value: string | null }>> {
  try {
    const admin = await assertAdmin();
    if (!Number.isInteger(accountId) || accountId <= 0) return { ok: false, error: "Unknown account." };
    if (field !== "login_password" && field !== "ptc_password") return { ok: false, error: "Unknown field." };
    const limit = rateLimit(`reveal:${admin.id}`, 60, 60 * 1000);
    if (!limit.ok) return { ok: false, error: tooManyAttempts(limit) };

    const ciphertext = await repo.getAccountSecret(accountId, field);
    return { ok: true, data: { value: ciphertext ? decryptCredential(ciphertext) : null } };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

const exportSchema = z.object({
  ids: z.array(z.number().int().positive()).max(5000).optional(),
  filters: z.record(z.string(), z.string()).optional(),
  includePasswords: z.boolean(),
});

export async function exportAccountsAction(input: {
  ids?: number[];
  filters?: Record<string, string>;
  includePasswords: boolean;
}): Promise<ActionResult<{ filename: string; csv: string; count: number }>> {
  try {
    const admin = await assertAdmin();
    const parsed = exportSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid export request." };
    const limit = rateLimit(`export:${admin.id}`, 10, 10 * 60 * 1000);
    if (!limit.ok) return { ok: false, error: tooManyAttempts(limit) };

    let ids = parsed.data.ids;
    if (!ids || ids.length === 0) {
      const query = parseAccountQuery((parsed.data.filters ?? {}) as SearchParams);
      const page = await repo.listAccounts({ ...query, page: 1, size: 5000 });
      ids = page.rows.map((row) => row.id);
    }
    if (ids.length === 0) return { ok: false, error: "There are no accounts to export." };

    const rows = await repo.exportAccounts(ids, parsed.data.includePasswords);
    const header = [
      "account_id", "type", "status", "asking_price", "login_email",
      ...(parsed.data.includePasswords ? ["login_password"] : []),
      "ptc_login",
      ...(parsed.data.includePasswords ? ["ptc_password"] : []),
      "submitted_by", "submitter_email", "created_at", "approved_at", "sold_at", "notes",
    ];
    const body = rows.map((row) => [
      formatAccountId(row.id), row.type, row.status, row.asking_price, row.login_email,
      ...(parsed.data.includePasswords ? [row.login_password_enc ? decryptCredential(row.login_password_enc) : ""] : []),
      row.ptc_login,
      ...(parsed.data.includePasswords ? [row.ptc_password_enc ? decryptCredential(row.ptc_password_enc) : ""] : []),
      row.submitter_name, row.submitter_email, row.created_at, row.approved_at, row.sold_at, row.notes,
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      ok: true,
      data: { filename: `go-accounts-${stamp}${parsed.data.includePasswords ? "-with-passwords" : ""}.csv`, csv: toCsv([header, ...body]), count: rows.length },
      message: `Exported ${rows.length} account${rows.length === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

const TYPE_ALIASES: Record<string, AccountType> = {
  NEW: "NEW", "NEW ID": "NEW", NEW_ID: "NEW",
  BOT: "BOT", "BOT ID": "BOT", BOT_ID: "BOT",
  OLD: "OLD", "OLD ID": "OLD", OLD_ID: "OLD",
};

export interface ImportResult {
  inserted: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export async function importAccountsAction(formData: FormData): Promise<ActionResult<ImportResult>> {
  try {
    const admin = await assertAdmin();
    const limit = rateLimit(`import:${admin.id}`, 10, 10 * 60 * 1000);
    if (!limit.ok) return { ok: false, error: tooManyAttempts(limit) };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file to import." };
    if (file.size > 1024 * 1024) return { ok: false, error: "The file is larger than 1 MB." };

    const table = parseCsv(await file.text());
    if (table.length < 2) return { ok: false, error: "The file has no data rows." };
    const header = table[0].map((cell) => cell.trim().toLowerCase());
    const missing = ["type", "login_email", "login_password"].filter((column) => !header.includes(column));
    if (missing.length) return { ok: false, error: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Expected: ${IMPORT_COLUMNS.join(", ")}` };
    if (table.length - 1 > 1000) return { ok: false, error: "You can import at most 1000 rows at once." };

    // Secrets are kept byte-exact; every other cell is trimmed.
    const rawCol = (row: string[], name: string) => {
      const index = header.indexOf(name);
      return index >= 0 ? (row[index] ?? "") : "";
    };
    const col = (row: string[], name: string) => rawCol(row, name).trim();

    const errors: ImportResult["errors"] = [];
    const payload: Parameters<typeof repo.importAccounts>[0] = [];
    const sourceRow: number[] = [];

    table.slice(1).forEach((row, index) => {
      const rowNumber = index + 2; // 1-based, counting the header line
      const type = TYPE_ALIASES[col(row, "type").toUpperCase()];
      const email = emailField.safeParse(col(row, "login_email"));
      const password = rawCol(row, "login_password");
      const ptcLogin = col(row, "ptc_login");
      const ptcPassword = rawCol(row, "ptc_password");
      const notes = col(row, "notes").slice(0, 1000);

      if (!type) return void errors.push({ row: rowNumber, message: "Type must be NEW, BOT or OLD" });
      if (!email.success) return void errors.push({ row: rowNumber, message: "Invalid login email" });
      if (!password || password.length > 128) return void errors.push({ row: rowNumber, message: "Missing or too long password" });
      if (ptcLogin && (!ptcPassword || /\s/.test(ptcLogin) || ptcLogin.length > 64)) {
        return void errors.push({ row: rowNumber, message: "Invalid PTC login/password pair" });
      }

      payload.push({
        type,
        login_email: email.data,
        login_password_enc: encryptCredential(password),
        ptc_login: ptcLogin || null,
        ptc_password_enc: ptcLogin && ptcPassword ? encryptCredential(ptcPassword) : null,
        notes: notes || null,
      });
      sourceRow.push(rowNumber);
    });

    let inserted = 0;
    if (payload.length > 0) {
      const result = await repo.importAccounts(payload);
      inserted = result.inserted;
      for (const err of result.errors) errors.push({ row: sourceRow[err.row - 1] ?? err.row, message: err.message });
    }
    errors.sort((a, b) => a.row - b.row);
    if (inserted > 0) refreshAll();

    const failed = table.length - 1 - inserted;
    return {
      ok: true,
      data: { inserted, failed, errors: errors.slice(0, 50) },
      message: inserted > 0
        ? `Imported ${inserted} account${inserted === 1 ? "" : "s"}${failed ? `, ${failed} skipped` : ""}.`
        : "No accounts were imported.",
    };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
