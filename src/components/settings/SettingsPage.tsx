import { CircleCheck, CircleX, Database, KeyRound, LockKeyhole, Settings, ShieldCheck, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { RoleBadge } from "@/components/ui/Badges";
import { PageHeader, Panel } from "@/components/ui/Panel";
import { getBackendMode } from "@/lib/backend";
import { formatDate } from "@/lib/format";
import { isEncryptionConfigured } from "@/lib/server/encryption";
import type { CurrentUser } from "@/lib/types";
import { PasswordForm, ProfileForm } from "./SettingsForms";

function Check({ ok, label, detail }: { ok: boolean; label: string; detail: ReactNode }) {
  return (
    <li className="flex gap-3">
      {ok ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" /> : <CircleX className="mt-0.5 size-5 shrink-0 text-rose-400" />}
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-slate-400">{detail}</p>
      </div>
    </li>
  );
}

export function SettingsPage({ user }: { user: CurrentUser }) {
  const mode = getBackendMode();
  const isAdmin = user.role === "ADMIN";
  const serviceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Account" title="Settings" icon={Settings} description="Manage your profile and sign-in security." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Profile" icon={UserRound}>
            <div className="mb-5 flex items-center gap-4">
              <Avatar name={user.fullName} seed={user.id} size="lg" />
              <div>
                <p className="font-semibold text-white">{user.fullName}</p>
                <div className="mt-1 flex items-center gap-2">
                  <RoleBadge role={user.role} />
                  <span className="text-xs text-slate-500">Member since {formatDate(user.createdAt)}</span>
                </div>
              </div>
            </div>
            <ProfileForm fullName={user.fullName} email={user.email} />
          </Panel>
          <Panel title="Change password" icon={KeyRound} description="Use at least 10 characters with letters and numbers.">
            <PasswordForm />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Security" icon={ShieldCheck}>
            <ul className="space-y-4">
              <Check ok label="Row Level Security" detail={isAdmin ? "Postgres policies scope every query to the signed-in user." : "You can only ever see your own submissions."} />
              <Check ok={isEncryptionConfigured()} label="Credential encryption" detail="AES-256-GCM, decrypted only on the server for admins." />
              <Check ok label="Audit trail" detail="Approvals, sales, reveals and exports are logged — never the secrets." />
              <Check ok label="Rate limiting" detail="Sign-in, registration, reveals, import and export are throttled." />
            </ul>
          </Panel>
          {isAdmin && (
            <Panel title="System" icon={Database}>
              <ul className="space-y-4">
                <Check
                  ok={mode === "supabase"}
                  label={mode === "supabase" ? "Supabase backend" : "Offline demo backend"}
                  detail={mode === "supabase" ? "Connected via the anon key + user sessions." : "Embedded Postgres with fictional data. Configure Supabase for production."}
                />
                {mode === "supabase" && (
                  <Check ok={serviceKey} label="Service role key" detail={serviceKey ? "Available server-side for banning disabled users." : "Optional — disabled users are still blocked by RLS."} />
                )}
              </ul>
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-white/[0.03] p-3 text-xs text-slate-400">
                <LockKeyhole className="mt-0.5 size-3.5 shrink-0" /> Keys and secrets are never displayed in the interface.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
