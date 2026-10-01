import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor, requestBackendMode } from "@/lib/server/session";
import { AuthCard } from "../AuthCard";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Login" };

const NOTICES: Record<string, string> = {
  disabled: "This account has been disabled. Contact an administrator.",
  confirm: "That confirmation link is invalid or has expired.",
  demo: "Demo data is not available.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const mode = await requestBackendMode();
  if (mode === "unconfigured") redirect("/setup");

  const user = await getCurrentUser();
  if (user?.isActive) redirect(homeFor(user));

  const next = typeof params.next === "string" && /^\/(admin|dashboard)(\/|\?|$)/.test(params.next) ? params.next : undefined;
  const notice = typeof params.error === "string" ? NOTICES[params.error] : undefined;

  return (
    <AuthCard subtitle="Account Inventory Management">
      <LoginForm next={next} notice={notice} demoMode={mode === "demo"} />
    </AuthCard>
  );
}
