import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountDetailView } from "@/components/accounts/AccountDetailView";
import { getAccountDetail } from "@/lib/server/repo";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Account" };

export default async function SubmitterAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireUser();
  const raw = (await params).id;
  const id = /^\d{1,15}$/.test(raw) ? Number(raw) : 0;
  // RLS returns null for accounts that belong to someone else.
  const account = id ? await getAccountDetail(id) : null;
  if (!account) notFound();
  return <AccountDetailView account={account} viewer={viewer} />;
}
