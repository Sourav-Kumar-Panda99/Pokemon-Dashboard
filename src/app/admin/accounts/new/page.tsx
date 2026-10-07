import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { AccountForm } from "@/components/accounts/AccountForm";
import { PageHeader } from "@/components/ui/Panel";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Add Account" };

export default async function NewAccountPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Inventory" title="Add Account" icon={Plus} description="Add a Pokémon GO account. Credentials are encrypted before storage." />
      <AccountForm role="ADMIN" base="/admin" />
    </div>
  );
}
