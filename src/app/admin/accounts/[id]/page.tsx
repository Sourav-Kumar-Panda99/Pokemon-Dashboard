import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountDetailView } from "@/components/accounts/AccountDetailView";
import { formatAccountId } from "@/lib/format";
import { getAccountDetail } from "@/lib/server/repo";
import { requireAdmin } from "@/lib/server/session";

function parseId(raw: string) {
  const id = Number.parseInt(raw, 10);
  return /^\d{1,15}$/.test(raw) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const parsed = parseId(id);
  return { title: parsed ? `Account ${formatAccountId(parsed)}` : "Account" };
}

export default async function AdminAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const id = parseId((await params).id);
  if (!id) notFound();
  const account = await getAccountDetail(id);
  if (!account) notFound();
  return <AccountDetailView account={account} viewer={viewer} />;
}
