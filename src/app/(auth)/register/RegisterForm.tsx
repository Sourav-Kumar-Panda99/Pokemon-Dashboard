"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CircleCheck, LoaderCircle, UserPlus } from "lucide-react";
import { registerAction, type AuthFormState } from "@/app/actions/auth";

function Field({
  id,
  label,
  type = "text",
  autoComplete,
  placeholder,
  defaultValue,
  error,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string[];
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required
        aria-invalid={Boolean(error)}
        className="input h-11 bg-navy-950/50"
      />
      {error && <p className="mt-1.5 text-xs text-rose-300">{error[0]}</p>}
    </div>
  );
}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(registerAction, {});
  const errors = state.fieldErrors ?? {};

  if (state.message) {
    return (
      <div className="text-center">
        <CircleCheck className="mx-auto size-12 text-emerald-400" />
        <p className="mt-3 text-sm text-slate-200">{state.message}</p>
        <Link href="/login" className="btn btn-primary mt-6 w-full">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error && (
        <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {state.error}
        </p>
      )}
      <Field id="fullName" label="Trainer name" autoComplete="name" placeholder="Your name" defaultValue={state.values?.fullName} error={errors.fullName} />
      <Field id="email" label="Email" type="email" autoComplete="email" placeholder="trainer@example.com" defaultValue={state.values?.email} error={errors.email} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="password" label="Password" type="password" autoComplete="new-password" placeholder="10+ characters" error={errors.password} />
        <Field id="confirmPassword" label="Confirm" type="password" autoComplete="new-password" placeholder="Repeat password" error={errors.confirmPassword} />
      </div>
      <p className="text-xs text-slate-400">New accounts join as submitters. An administrator can grant more access later.</p>
      <button type="submit" className="btn btn-primary h-12 w-full text-base" disabled={pending}>
        {pending ? <LoaderCircle className="size-5 animate-spin" /> : <UserPlus className="size-5" />}
        Create account
      </button>
      <p className="text-center text-sm text-slate-300">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-poke-yellow hover:text-white">
          Log in
        </Link>
      </p>
    </form>
  );
}
