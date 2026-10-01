export type Role = "ADMIN" | "SUBMITTER";
export type AccountType = "NEW" | "BOT" | "OLD";
export type AccountStatus = "PENDING" | "APPROVED" | "UNSOLD" | "SOLD" | "REJECTED";
export type StatusAction = "APPROVE" | "REJECT" | "MARK_SOLD" | "MARK_UNSOLD";
export type CredentialField = "login_password" | "ptc_password";

export type ActivityAction =
  | "CREATED"
  | "SUBMITTED"
  | "EDITED"
  | "TYPE_CHANGED"
  | "STATUS_CHANGED"
  | "APPROVED"
  | "REJECTED"
  | "MARKED_SOLD"
  | "MARKED_UNSOLD"
  | "DELETED"
  | "CREDENTIALS_UPDATED"
  | "CREDENTIALS_REVEALED"
  | "IMPORTED"
  | "EXPORTED"
  | "USER_REGISTERED"
  | "USER_ROLE_CHANGED"
  | "USER_DISABLED"
  | "USER_ENABLED";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Paginated<T> {
  total: number;
  page: number;
  page_size: number;
  rows: T[];
}

export interface AccountRow {
  id: number;
  type: AccountType;
  status: AccountStatus;
  notes: string | null;
  asking_price: number | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  sold_at: string | null;
  submitter_id: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  login_email: string;
  ptc_login: string | null;
  sale_price: number | null;
}

export interface AccountStats {
  total: number;
  new: number;
  bot: number;
  old: number;
  pending: number;
  approved: number;
  unsold: number;
  sold: number;
  rejected: number;
  reviewed: number;
  sold_this_month: number;
  added_this_week: number;
}

export interface ActivityEntry {
  id: number;
  action: ActivityAction;
  details: Record<string, unknown>;
  created_at: string;
  account_ref?: number | null;
  account_exists?: boolean;
  actor_id: string | null;
  actor_name: string | null;
  actor_email?: string | null;
  actor_role?: Role | null;
  target_user_id?: string | null;
  target_name?: string | null;
  target_email?: string | null;
}

export interface AccountDetail {
  id: number;
  type: AccountType;
  status: AccountStatus;
  notes: string | null;
  asking_price: number | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  sold_at: string | null;
  submitter_id: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  approved_by_name: string | null;
  rejected_by_name: string | null;
  sold_by_name: string | null;
  login_email: string;
  ptc_login: string | null;
  credentials_updated_at: string;
  sale_price: number | null;
  activity: ActivityEntry[];
}

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  accounts_total: number;
  accounts_pending: number;
  accounts_sold: number;
  last_submission_at: string | null;
}

export interface UserList extends Paginated<UserRow> {
  active_admins: number;
}

export interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  accounts_total: number;
  accounts_pending: number;
  accounts_unsold: number;
  accounts_sold: number;
  accounts_rejected: number;
}

export interface SubmitterOption {
  id: string;
  full_name: string;
  email: string;
  role: Role;
}

export interface SalesOverview {
  total_sold: number;
  total_unsold: number;
  available: number;
  sold_this_month: number;
  sold_in_range: number;
  revenue_total: number;
  revenue_this_month: number;
  sold_by_type: Record<AccountType, number>;
  monthly: Array<{ month: string; count: number; revenue: number }>;
}

export interface NotificationRow {
  id: number;
  account_id: number | null;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationFeed {
  unread: number;
  rows: NotificationRow[];
}

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };
