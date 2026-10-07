import { ROLE_META, STATUS_META, TYPE_META } from "@/lib/constants";
import type { AccountStatus, AccountType, Role } from "@/lib/types";

const base =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap uppercase transition-colors duration-300";

export function AccountTypeBadge({ type, className = "" }: { type: AccountType; className?: string }) {
  const meta = TYPE_META[type];
  return (
    <span className={`${base} ${meta.badge} ${className}`}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

export function AccountStatusBadge({ status, className = "" }: { status: AccountStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={`${base} ${meta.badge} ${className}`}>
      <span className={`size-1.5 rounded-full ${meta.dot} ${status === "PENDING" ? "animate-pulse" : ""}`} />
      {meta.label}
    </span>
  );
}

/** Admin approval of a sale: suppliers record sales, an admin approves them for the records. */
export function SaleApprovalBadge({ approved, className = "" }: { approved: boolean; className?: string }) {
  return approved ? (
    <span className={`${base} border-emerald-400/40 bg-emerald-500/15 text-emerald-300 ${className}`}>
      <span className="size-1.5 rounded-full bg-emerald-400" />
      Approved
    </span>
  ) : (
    <span className={`${base} border-amber-400/40 bg-amber-500/15 text-amber-200 ${className}`}>
      <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
      Awaiting approval
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role];
  return <span className={`${base} ${meta.badge}`}>{meta.label}</span>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className={`${base} border-emerald-400/40 bg-emerald-500/15 text-emerald-300`}>
      <span className="size-1.5 rounded-full bg-emerald-400" />
      Active
    </span>
  ) : (
    <span className={`${base} border-red-400/40 bg-red-500/15 text-red-300`}>
      <span className="size-1.5 rounded-full bg-red-400" />
      Disabled
    </span>
  );
}
