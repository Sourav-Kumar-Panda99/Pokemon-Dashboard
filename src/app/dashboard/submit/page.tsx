import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { AccountForm } from "@/components/accounts/AccountForm";
import { PageHeader } from "@/components/ui/Panel";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Submit Account" };

export default async function SubmitAccountPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="New submission" title="Submit Account" icon={Plus} description="Your account goes into stock right away. When you sell it, mark it as sold and an admin approves the sale." />
      <AccountForm role={user.role} base="/dashboard" />
    </div>
  );
}
