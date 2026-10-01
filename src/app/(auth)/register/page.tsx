import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor, requestBackendMode } from "@/lib/server/session";
import { AuthCard } from "../AuthCard";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage() {
  if ((await requestBackendMode()) === "unconfigured") redirect("/setup");
  const user = await getCurrentUser();
  if (user?.isActive) redirect(homeFor(user));

  return (
    <AuthCard subtitle="Join as a submitter">
      <RegisterForm />
    </AuthCard>
  );
}
