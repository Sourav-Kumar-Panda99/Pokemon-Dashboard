import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { AccountForm } from "@/components/accounts/AccountForm";
import { AccountStatusBadge } from "@/components/ui/Badges";
import { PageHeader } from "@/components/ui/Panel";
import { formatAccountId } from "@/lib/format";
import { getAccountDetail } from "@/lib/server/repo";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Edit Account" };

export default async function AdminEditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const raw = (await params).id;
  const id = /^\d{1,15}$/.test(raw) ? Number(raw) : 0;
  const account = id ? await getAccountDetail(id) : null;
  if (!account) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title={`Edit ${formatAccountId(account.id)}`}
        icon={Pencil}
        description={
          <span className="inline-flex items-center gap-2">
            Current status <AccountStatusBadge status={account.status} /> · leave password fields blank to keep them.
          </span>
        }
      />
      <AccountForm
        role="ADMIN"
        base="/admin"
        defaults={{
          id: account.id,
          type: account.type,
          status: account.status,
          loginEmail: account.login_email,
          ptcLogin: account.ptc_login,
          notes: account.notes,
        }}
      />
    </div>
  );
}
