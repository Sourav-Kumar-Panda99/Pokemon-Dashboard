import type { AccountStatus, AccountType, Role, StatusAction } from "./types";

export const ACCOUNT_TYPES: AccountType[] = ["NEW", "BOT", "OLD"];
export const ACCOUNT_STATUSES: AccountStatus[] = ["PENDING", "APPROVED", "UNSOLD", "SOLD", "REJECTED"];

export const TYPE_META: Record<AccountType, { label: string; short: string; badge: string; dot: string; glow: string }> = {
  NEW: {
    label: "NEW ID",
    short: "New",
    badge: "border-sky-400/40 bg-sky-500/15 text-sky-300",
    dot: "bg-sky-400",
    glow: "shadow-[0_0_24px_-6px_rgba(56,189,248,0.6)]",
  },
  BOT: {
    label: "BOT ID",
    short: "Bot",
    badge: "border-violet-400/40 bg-violet-500/15 text-violet-300",
    dot: "bg-violet-400",
    glow: "shadow-[0_0_24px_-6px_rgba(167,139,250,0.6)]",
  },
  OLD: {
    label: "OLD ID",
    short: "Old",
    badge: "border-amber-400/40 bg-amber-500/15 text-amber-300",
    dot: "bg-amber-400",
    glow: "shadow-[0_0_24px_-6px_rgba(251,191,36,0.6)]",
  },
};

export const STATUS_META: Record<AccountStatus, { label: string; badge: string; dot: string }> = {
  PENDING: { label: "Pending", badge: "border-yellow-400/40 bg-yellow-400/15 text-yellow-300", dot: "bg-yellow-400" },
  APPROVED: { label: "Approved", badge: "border-blue-400/40 bg-blue-500/15 text-blue-300", dot: "bg-blue-400" },
  UNSOLD: { label: "Unsold", badge: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300", dot: "bg-emerald-400" },
  SOLD: { label: "Sold", badge: "border-rose-400/40 bg-rose-500/15 text-rose-300", dot: "bg-rose-400" },
  REJECTED: { label: "Rejected", badge: "border-slate-400/30 bg-slate-500/15 text-slate-300", dot: "bg-slate-400" },
};

export const ROLE_META: Record<Role, { label: string; badge: string }> = {
  ADMIN: { label: "Admin", badge: "border-yellow-400/40 bg-yellow-400/15 text-yellow-200" },
  SUBMITTER: { label: "Submitter", badge: "border-sky-400/30 bg-sky-500/10 text-sky-200" },
};

export const SORT_OPTIONS = [
  { value: "created_at:desc", label: "Newest first" },
  { value: "created_at:asc", label: "Oldest first" },
  { value: "updated_at:desc", label: "Recently updated" },
  { value: "id:asc", label: "Account ID ↑" },
  { value: "id:desc", label: "Account ID ↓" },
  { value: "sold_at:desc", label: "Recently sold" },
  { value: "login_email:asc", label: "Login email A–Z" },
  { value: "submitter:asc", label: "Submitter A–Z" },
  { value: "type:asc", label: "Type" },
  { value: "status:asc", label: "Status" },
] as const;

export const SORT_KEYS = ["id", "created_at", "updated_at", "sold_at", "type", "status", "login_email", "submitter"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

/** Mirrors the transitions allowed by public.set_account_status in Postgres. */
export const STATUS_ACTION_FROM: Record<StatusAction, AccountStatus[]> = {
  APPROVE: ["PENDING", "REJECTED"],
  REJECT: ["PENDING", "APPROVED", "UNSOLD"],
  MARK_SOLD: ["APPROVED", "UNSOLD"],
  MARK_UNSOLD: ["APPROVED", "SOLD"],
};

/** How long a revealed credential stays visible before re-masking. */
export const REVEAL_TIMEOUT_MS = 30_000;
