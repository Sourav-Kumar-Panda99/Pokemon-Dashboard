import { redirect } from "next/navigation";
import { getCurrentUser, homeFor, requestBackendMode } from "@/lib/server/session";

export default async function Home() {
  if ((await requestBackendMode()) === "unconfigured") redirect("/setup");
  const user = await getCurrentUser();
  if (!user || !user.isActive) redirect("/login");
  redirect(homeFor(user));
}
