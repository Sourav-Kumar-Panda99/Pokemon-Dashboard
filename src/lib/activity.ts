import { STATUS_META, TYPE_META, ROLE_META } from "./constants";
import { formatAccountId } from "./format";
import type { AccountStatus, AccountType, ActivityAction, ActivityEntry, Role } from "./types";

const FIELD_LABELS: Record<string, string> = {
  login_email: "login email",
  login_password: "password",
  ptc_login: "PTC login",
  ptc_password: "PTC password",
  notes: "notes",
  asking_price: "asking price",
  sale_price: "sold price",
};

export const ACTION_LABELS: Record<ActivityAction, string> = {
  CREATED: "Created",
  SUBMITTED: "Submitted",
  EDITED: "Edited",
  TYPE_CHANGED: "Type changed",
  STATUS_CHANGED: "Status changed",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  MARKED_SOLD: "Marked sold",
  MARKED_UNSOLD: "Marked unsold",
  DELETED: "Deleted",
  CREDENTIALS_UPDATED: "Credentials updated",
  CREDENTIALS_REVEALED: "Credentials revealed",
  IMPORTED: "Imported",
  EXPORTED: "Exported",
  USER_REGISTERED: "User registered",
  USER_ROLE_CHANGED: "Role changed",
  USER_DISABLED: "User disabled",
  USER_ENABLED: "User enabled",
};

export const ACTION_TONE: Record<ActivityAction, string> = {
  CREATED: "bg-sky-500/20 text-sky-300 ring-sky-400/30",
  SUBMITTED: "bg-sky-500/20 text-sky-300 ring-sky-400/30",
  IMPORTED: "bg-sky-500/20 text-sky-300 ring-sky-400/30",
  EDITED: "bg-slate-500/20 text-slate-300 ring-slate-400/30",
  CREDENTIALS_UPDATED: "bg-slate-500/20 text-slate-300 ring-slate-400/30",
  TYPE_CHANGED: "bg-violet-500/20 text-violet-300 ring-violet-400/30",
  STATUS_CHANGED: "bg-blue-500/20 text-blue-300 ring-blue-400/30",
  APPROVED: "bg-emerald-500/20 text-emerald-300 ring-emerald-400/30",
  REJECTED: "bg-slate-500/25 text-slate-300 ring-slate-400/30",
  MARKED_SOLD: "bg-rose-500/20 text-rose-300 ring-rose-400/30",
  MARKED_UNSOLD: "bg-emerald-500/20 text-emerald-300 ring-emerald-400/30",
  DELETED: "bg-red-500/20 text-red-300 ring-red-400/30",
  CREDENTIALS_REVEALED: "bg-yellow-400/20 text-yellow-200 ring-yellow-400/30",
  EXPORTED: "bg-cyan-500/20 text-cyan-300 ring-cyan-400/30",
  USER_REGISTERED: "bg-sky-500/20 text-sky-300 ring-sky-400/30",
  USER_ROLE_CHANGED: "bg-yellow-400/20 text-yellow-200 ring-yellow-400/30",
  USER_DISABLED: "bg-red-500/20 text-red-300 ring-red-400/30",
  USER_ENABLED: "bg-emerald-500/20 text-emerald-300 ring-emerald-400/30",
};

const niceType = (value: unknown) => (TYPE_META[value as AccountType] ? `${TYPE_META[value as AccountType].short} ID` : String(value));
// UNSOLD / APPROVED no longer exist but still appear in older history entries.
const LEGACY_STATUS_LABELS: Record<string, string> = { UNSOLD: "Unsold", APPROVED: "Approved" };
const statusLabel = (value: unknown) => STATUS_META[value as AccountStatus]?.label ?? LEGACY_STATUS_LABELS[String(value)] ?? String(value);
const roleLabel = (value: unknown) => ROLE_META[value as Role]?.label ?? String(value);

/**
 * Human sentence for an activity entry. `viewerId` lets submitters see "You";
 * actors hidden by RLS (admins, from a submitter's point of view) read "Admin".
 */
export function describeActivity(entry: ActivityEntry, viewerId?: string): string {
  const actor =
    entry.actor_id && entry.actor_id === viewerId ? "You" : entry.actor_name || (entry.actor_id ? "Admin" : "System");
  const account = formatAccountId(entry.account_ref ?? null);
  const target = entry.target_name || entry.target_email || "a user";
  const d = entry.details ?? {};

  switch (entry.action) {
    case "SUBMITTED":
      return `${actor} submitted account ${account}`;
    case "CREATED":
      return `${actor} added account ${account}`;
    case "IMPORTED":
      return `${actor} imported account ${account}`;
    case "APPROVED":
      // `sale` marks the admin approval of a sale recorded by a supplier; older entries approved a submission.
      return d.sale ? `${actor} approved the sale of account ${account}` : `${actor} approved account ${account}`;
    case "REJECTED":
      return `${actor} rejected account ${account}${d.reason ? ` — ${String(d.reason)}` : ""}`;
    case "MARKED_SOLD":
      return `${actor} marked account ${account} as Sold`;
    case "MARKED_UNSOLD":
      return `${actor} marked account ${account} as Unsold`;
    case "TYPE_CHANGED":
      return `${actor} changed ${account} from ${niceType(d.from)} to ${niceType(d.to)}`;
    case "STATUS_CHANGED":
      return `${actor} changed ${account} from ${statusLabel(d.from)} to ${statusLabel(d.to)}`;
    case "EDITED": {
      const fields = Array.isArray(d.fields) ? d.fields.map((f) => FIELD_LABELS[String(f)] ?? String(f)).join(" and ") : "details";
      return `${actor} edited the ${fields} on ${account}`;
    }
    case "CREDENTIALS_UPDATED": {
      const fields = Array.isArray(d.fields) ? d.fields.map((f) => FIELD_LABELS[String(f)] ?? String(f)).join(", ") : "credentials";
      return `${actor} updated ${fields} on ${account}`;
    }
    case "CREDENTIALS_REVEALED":
      return `${actor} revealed the ${FIELD_LABELS[String(d.field)] ?? "credentials"} of ${account}`;
    case "DELETED":
      return `${actor} deleted account ${account}`;
    case "EXPORTED":
      return `${actor} exported ${Number(d.count ?? 0)} accounts${d.with_passwords ? " (with passwords)" : ""}`;
    case "USER_REGISTERED":
      return `${target} joined as a submitter`;
    case "USER_ROLE_CHANGED":
      return `${actor} changed ${target}'s role from ${roleLabel(d.from)} to ${roleLabel(d.to)}`;
    case "USER_DISABLED":
      return `${actor} disabled ${target}`;
    case "USER_ENABLED":
      return `${actor} re-enabled ${target}`;
    default:
      return `${actor} · ${entry.action}`;
  }
}
