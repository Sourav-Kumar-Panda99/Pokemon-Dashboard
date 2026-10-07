import Link from "next/link";
import { ArrowLeft, CalendarClock, ClipboardList, KeyRound, LockKeyhole, NotebookPen, PackageCheck, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { ActivityTimeline } from "@/components/activity/ActivityLog";
import { CaptureBall } from "@/components/art/CaptureBall";
import { Avatar } from "@/components/ui/Avatar";
import { AccountStatusBadge, AccountTypeBadge, SaleApprovalBadge } from "@/components/ui/Badges";
import { CopyButton } from "@/components/ui/CopyButton";
import { Panel } from "@/components/ui/Panel";
import { TYPE_META, saleAwaitingApproval } from "@/lib/constants";
import { formatAccountId, formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { AccountDetail, CurrentUser } from "@/lib/types";
import { AccountDetailActions } from "./AccountDetailActions";
import { CredentialReveal } from "./CredentialReveal";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-slate-200">{children}</dd>
    </div>
  );
}

const TYPE_RING = { NEW: "from-sky-400/40", BOT: "from-violet-400/40", OLD: "from-amber-400/40" } as const;
const BALL_VARIANT = { NEW: "great", BOT: "ultra", OLD: "classic" } as const;

export function AccountDetailView({ account, viewer }: { account: AccountDetail; viewer: CurrentUser }) {
  const isAdmin = viewer.role === "ADMIN";
  const base = isAdmin ? "/admin" : "/dashboard";
  const adminLabel = (name: string | null) => name ?? (isAdmin ? "Deleted user" : "Admin");
  const awaitingApproval = saleAwaitingApproval(account);
  // Suppliers cannot read admin profiles, so an admin's name arrives as null for them.
  const soldBy = account.sold_by && account.sold_by === viewer.id ? "You" : adminLabel(account.sold_by_name);
  const inventoryState = account.status === "SOLD" ? "Sold" : account.status === "PENDING" ? "Pending · in stock" : "Rejected · not for sale";

  return (
    <div className="space-y-6">
      <Link href={isAdmin ? "/admin/accounts" : "/dashboard"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-white">
        <ArrowLeft className="size-4" /> {isAdmin ? "All accounts" : "My submissions"}
      </Link>

      {/* Pokédex-style header */}
      <section className="card relative overflow-hidden p-5 animate-fade-up sm:p-7">
        <div className="map-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className={`pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-gradient-to-br ${TYPE_RING[account.type]} to-transparent blur-3xl`} />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <span className={`absolute inset-0 rounded-full ${TYPE_META[account.type].glow}`} />
              <div className="animate-float">
                <CaptureBall size={76} variant={BALL_VARIANT[account.type]} />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.2em] text-poke-yellow uppercase">Account</p>
              <h1 className="font-display text-3xl font-semibold text-white sm:text-4xl">{formatAccountId(account.id)}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <AccountTypeBadge type={account.type} />
                <AccountStatusBadge status={account.status} />
                {awaitingApproval && <SaleApprovalBadge approved={false} />}
                <span className="text-xs text-slate-400">Added {formatDate(account.created_at)}</span>
              </div>
            </div>
          </div>
          <AccountDetailActions
            account={{ id: account.id, login_email: account.login_email, ptc_login: account.ptc_login, type: account.type, status: account.status, asking_price: account.asking_price, approved_at: account.approved_at }}
            role={viewer.role}
            base={base}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="grid gap-6 md:grid-cols-2">
            <Panel title="Login Credentials" icon={KeyRound}>
              <dl className="divide-y divide-white/[0.05]">
                <Row label="ID Login Mail">
                  <span className="inline-flex max-w-full items-center gap-1">
                    <span className="truncate">{account.login_email}</span>
                    <CopyButton value={account.login_email} label="Copy login email" />
                  </span>
                </Row>
                <Row label="Password">
                  <CredentialReveal accountId={account.id} field="login_password" canReveal={isAdmin} size="md" />
                </Row>
              </dl>
            </Panel>
            <Panel title="PTC Credentials" icon={UserRound}>
              <dl className="divide-y divide-white/[0.05]">
                <Row label="PTC Login">
                  {account.ptc_login ? (
                    <span className="inline-flex max-w-full items-center gap-1">
                      <span className="truncate font-mono">{account.ptc_login}</span>
                      <CopyButton value={account.ptc_login} label="Copy PTC login" />
                    </span>
                  ) : (
                    <span className="text-slate-500">Not provided</span>
                  )}
                </Row>
                <Row label="PTC Password">
                  <CredentialReveal accountId={account.id} field="ptc_password" canReveal={isAdmin} present={Boolean(account.ptc_login)} size="md" />
                </Row>
              </dl>
            </Panel>
          </div>
          {!isAdmin && (
            <p className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-xs text-slate-400">
              <LockKeyhole className="size-4 text-emerald-400" /> Passwords are encrypted and stay hidden. Only administrators can reveal them, and every reveal is logged.
            </p>
          )}

          <Panel title="Notes" icon={NotebookPen}>
            {account.notes ? <p className="text-sm whitespace-pre-wrap text-slate-300">{account.notes}</p> : <p className="text-sm text-slate-500">No notes for this account.</p>}
          </Panel>

          <Panel title="Activity" icon={ClipboardList} description="Every change is recorded with a timestamp.">
            {account.activity.length ? (
              <ActivityTimeline entries={account.activity.map((e) => ({ ...e, account_ref: account.id }))} viewerId={viewer.id} />
            ) : (
              <p className="text-sm text-slate-500">No activity yet.</p>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Account Overview" icon={CalendarClock}>
            <dl className="divide-y divide-white/[0.05]">
              <Row label="Account ID">
                <span className="font-mono font-semibold">{formatAccountId(account.id)}</span>
              </Row>
              <Row label="Type">
                <AccountTypeBadge type={account.type} />
              </Row>
              <Row label="Status">
                <AccountStatusBadge status={account.status} />
              </Row>
              <Row label="Submitted By">
                {account.submitter_id ? (
                  isAdmin ? (
                    <Link href={`/admin/users/${account.submitter_id}`} className="inline-flex items-center gap-2 hover:text-poke-sky">
                      <Avatar name={account.submitter_name} seed={account.submitter_id} size="xs" />
                      {account.submitter_name || account.submitter_email}
                    </Link>
                  ) : (
                    <span>{account.submitter_id === viewer.id ? "You" : account.submitter_name}</span>
                  )
                ) : (
                  <span className="text-slate-500">Deleted user</span>
                )}
              </Row>
              <Row label="Created">{formatDateTime(account.created_at)}</Row>
              <Row label="Updated">{formatDateTime(account.updated_at)}</Row>
            </dl>
          </Panel>

          <Panel title="Inventory" icon={PackageCheck}>
            <dl className="divide-y divide-white/[0.05]">
              <Row label="State">
                <span className={account.status === "SOLD" ? "font-semibold text-rose-300" : account.status === "PENDING" ? "font-semibold text-yellow-200" : "text-slate-400"}>
                  {inventoryState}
                </span>
              </Row>
              {(account.type === "NEW" || account.asking_price !== null) && (
                <Row label="Asking Price">
                  {account.asking_price !== null ? <span className="font-semibold text-sky-200">{formatCurrency(account.asking_price)}</span> : "—"}
                </Row>
              )}
              <Row label="Sale Date">{account.sold_at ? formatDateTime(account.sold_at) : "—"}</Row>
              {/* Admins see every price; suppliers only the price of a sale they recorded themselves. */}
              {(isAdmin || account.sale_price !== null) && (
                <Row label="Sold For">
                  {account.sale_price !== null ? <span className="font-semibold text-emerald-300">{formatCurrency(account.sale_price)}</span> : "—"}
                </Row>
              )}
              {account.sold_at && <Row label="Sold By">{soldBy}</Row>}
              {account.status === "SOLD" && (
                <Row label="Sale Approval">
                  {awaitingApproval ? (
                    <SaleApprovalBadge approved={false} />
                  ) : (
                    <span className="text-emerald-300">
                      Approved by {adminLabel(account.approved_by_name)}
                      <span className="block text-xs text-slate-400">{formatDateTime(account.approved_at)}</span>
                    </span>
                  )}
                </Row>
              )}
              {account.rejected_at && <Row label="Rejected At">{formatDateTime(account.rejected_at)}</Row>}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
