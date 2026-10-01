import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LockKeyhole, Pencil } from "lucide-react";
import { AccountForm } from "@/components/accounts/AccountForm";
import { PageHeader } from "@/components/ui/Panel";
import { formatAccountId } from "@/lib/format";
import { getAccountDetail } from "@/lib/server/repo";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Edit Submission" };

export default async function SubmitterEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const raw = (await params).id;
  const id = /^\d{1,15}$/.test(raw) ? Number(raw) : 0;
  const account = id ? await getAccountDetail(id) : null;
  if (!account || account.submitter_id !== user.id) notFound();

  if (account.status !== "PENDING") {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <LockKeyhole className="mx-auto size-10 text-poke-yellow" />
        <h1 className="mt-4 font-display text-xl font-semibold text-white">{formatAccountId(account.id)} can no longer be edited</h1>
        <p className="mt-2 text-sm text-slate-400">Submissions are locked once an admin has reviewed them.</p>
        <Link href={`/dashboard/accounts/${account.id}`} className="btn btn-primary mt-6">
          View account
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pending submission"
        title={`Edit ${formatAccountId(account.id)}`}
        icon={Pencil}
        description="Leave password fields blank to keep the values you submitted."
      />
      <AccountForm
        role="SUBMITTER"
        base="/dashboard"
        defaults={{
          id: account.id,
          type: account.type,
          status: account.status,
          loginEmail: account.login_email,
          ptcLogin: account.ptc_login,
          notes: account.notes,
          askingPrice: account.asking_price,
        }}
      />
    </div>
  );
}
