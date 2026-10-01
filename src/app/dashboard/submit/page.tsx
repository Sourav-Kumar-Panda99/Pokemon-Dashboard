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
      <PageHeader eyebrow="New submission" title="Submit Account" icon={Plus} description="Your submission is reviewed by an admin before it joins the inventory." />
      <AccountForm role={user.role} base="/dashboard" />
    </div>
  );
}
