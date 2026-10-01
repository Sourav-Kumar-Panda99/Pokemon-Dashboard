import { ShellLayout } from "@/components/layout/ShellLayout";
import { requireAdmin } from "@/lib/server/session";

// Every admin route is gated here on the server; each server action and
// database function re-checks the role independently.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <ShellLayout user={user}>{children}</ShellLayout>;
}
