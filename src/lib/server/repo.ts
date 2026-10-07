import "server-only";
import type { AccountQuery } from "@/lib/validation";
import type {
  AccountDetail,
  AccountRow,
  AccountStats,
  AccountStatus,
  AccountType,
  ActivityAction,
  ActivityEntry,
  CredentialField,
  NotificationFeed,
  Paginated,
  Role,
  SalesOverview,
  StatusAction,
  SubmitterOption,
  UserList,
  UserSummary,
} from "@/lib/types";
import { rpc } from "./db";

// Typed wrappers around the database functions. All of them run as the
// signed-in user; Postgres decides what that user may see or change.

export function listAccounts(query: Partial<AccountQuery> & { dateField?: "created_at" | "sold_at" }) {
  return rpc<Paginated<AccountRow>>("list_accounts", {
    p_search: query.q,
    p_type: query.type,
    p_status: query.status,
    p_approval: query.approval,
    p_submitter_id: query.submitter,
    p_date_from: query.from,
    p_date_to: query.to,
    p_date_field: query.dateField,
    p_sort: query.sort,
    p_dir: query.dir,
    p_page: query.page,
    p_page_size: query.size,
  });
}

export const getAccountStats = () => rpc<AccountStats>("account_stats");

export const getAccountDetail = (id: number) => rpc<AccountDetail | null>("get_account_detail", { p_account_id: id });

export const listActivity = (filters: { q?: string; action?: ActivityAction; from?: string; to?: string; page?: number; size?: number }) =>
  rpc<Paginated<ActivityEntry>>("list_activity", {
    p_search: filters.q,
    p_action: filters.action,
    p_date_from: filters.from,
    p_date_to: filters.to,
    p_page: filters.page,
    p_page_size: filters.size,
  });

export const listMyActivity = (page = 1, size = 25) =>
  rpc<Paginated<ActivityEntry>>("list_my_activity", { p_page: page, p_page_size: size });

export const listUsers = (filters: { q?: string; role?: Role; active?: boolean; page?: number; size?: number }) =>
  rpc<UserList>("list_users", {
    p_search: filters.q,
    p_role: filters.role,
    p_active: filters.active,
    p_page: filters.page,
    p_page_size: filters.size,
  });

export const getUserSummary = (id: string) => rpc<UserSummary | null>("get_user_summary", { p_user_id: id });

export const listSubmitters = () => rpc<SubmitterOption[]>("list_submitters");

export const getSalesOverview = (from?: string, to?: string) =>
  rpc<SalesOverview>("sales_overview", { p_date_from: from, p_date_to: to });

export const listNotifications = (limit = 8) => rpc<NotificationFeed>("list_notifications", { p_limit: limit });

// --- mutations -----------------------------------------------------------------

export const submitAccount = (input: {
  type: AccountType;
  loginEmail: string;
  loginPasswordEnc: string;
  ptcLogin?: string;
  ptcPasswordEnc?: string;
  notes?: string;
  askingPrice?: number;
}) =>
  rpc<number>("submit_account", {
    p_type: input.type,
    p_login_email: input.loginEmail,
    p_login_password_enc: input.loginPasswordEnc,
    p_ptc_login: input.ptcLogin ?? null,
    p_ptc_password_enc: input.ptcPasswordEnc ?? null,
    p_notes: input.notes ?? null,
    p_asking_price: input.askingPrice ?? null,
  });

export const updateAccount = (input: {
  id: number;
  type: AccountType;
  loginEmail: string;
  loginPasswordEnc?: string;
  ptcLogin?: string;
  ptcPasswordEnc?: string;
  notes?: string;
  status?: AccountStatus;
  askingPrice?: number;
  salePrice?: number;
}) =>
  rpc<void>("update_account", {
    p_account_id: input.id,
    p_type: input.type,
    p_login_email: input.loginEmail,
    p_login_password_enc: input.loginPasswordEnc ?? null,
    p_ptc_login: input.ptcLogin ?? null,
    p_ptc_password_enc: input.ptcPasswordEnc ?? null,
    p_notes: input.notes ?? null,
    p_status: input.status ?? null,
    p_asking_price: input.askingPrice ?? null,
    p_sale_price: input.salePrice ?? null,
  });

export const setAccountStatus = (ids: number[], action: StatusAction, price?: number | null, reason?: string) =>
  rpc<{ updated: number; skipped: number }>("set_account_status", {
    p_account_ids: ids,
    p_action: action,
    p_price: price ?? null,
    p_reason: reason ?? null,
  });

/** Admin only: approves sales recorded by suppliers. The sales themselves are not changed. */
export const approveSales = (ids: number[]) => rpc<{ updated: number; skipped: number }>("approve_sales", { p_account_ids: ids });

export const setAccountType = (ids: number[], type: AccountType) =>
  rpc<{ updated: number }>("set_account_type", { p_account_ids: ids, p_type: type });

export const deleteAccounts = (ids: number[]) => rpc<{ deleted: number }>("delete_accounts", { p_account_ids: ids });

export const getAccountSecret = (id: number, field: CredentialField) =>
  rpc<string | null>("admin_get_account_secret", { p_account_id: id, p_field: field });

export interface ExportRow {
  id: number;
  type: AccountType;
  status: AccountStatus;
  asking_price: number | null;
  login_email: string;
  ptc_login: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  sold_at: string | null;
  login_password_enc?: string;
  ptc_password_enc?: string | null;
}

export const exportAccounts = (ids: number[], includeSecrets: boolean) =>
  rpc<ExportRow[]>("admin_export_accounts", { p_account_ids: ids, p_include_secrets: includeSecrets });

export const importAccounts = (
  rows: Array<{ type: AccountType; login_email: string; login_password_enc: string; ptc_login: string | null; ptc_password_enc: string | null; notes: string | null }>,
) =>
  rpc<{ inserted: number; failed: number; errors: Array<{ row: number; message: string }> }>("admin_import_accounts", {
    p_rows: rows,
  });

export const setUserRole = (userId: string, role: Role) => rpc<void>("admin_set_user_role", { p_user_id: userId, p_role: role });

export const setUserActive = (userId: string, active: boolean) =>
  rpc<void>("admin_set_user_active", { p_user_id: userId, p_active: active });

export const updateMyProfile = (fullName: string) => rpc<void>("update_my_profile", { p_full_name: fullName });

export const markNotificationsRead = (ids?: number[]) => rpc<void>("mark_notifications_read", { p_ids: ids ?? null });
