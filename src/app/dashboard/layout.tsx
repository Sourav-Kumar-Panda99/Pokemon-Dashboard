import { redirect } from "next/navigation";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { requireUser } from "@/lib/server/session";

export default async function SubmitterLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin");
  return <ShellLayout user={user}>{children}</ShellLayout>;
}
