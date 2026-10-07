import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SubmitterSettingsPage() {
  const user = await requireUser();
  return <SettingsPage user={user} />;
}
