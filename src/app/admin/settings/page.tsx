import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const user = await requireAdmin();
  return <SettingsPage user={user} />;
}
