"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, LogIn, Mail, ShieldCheck, UserRound } from "lucide-react";
import { demoLoginAction, loginAction, type AuthFormState } from "@/app/actions/auth";

export function LoginForm({ next, notice, demoMode }: { next?: string; notice?: string; demoMode: boolean }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const errors = state.fieldErrors ?? {};
  const message = state.error ?? notice;

  return (
    <>
      <form action={formAction} className="space-y-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        {message && (
          <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {message}
          </p>
        )}
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={state.values?.email}
              placeholder="trainer@example.com"
              aria-invalid={Boolean(errors.email)}
              className="input h-12 bg-navy-950/50 pl-10"
            />
          </div>
          {errors.email && <p className="mt-1.5 text-xs text-rose-300">{errors.email[0]}</p>}
        </div>
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••••"
              aria-invalid={Boolean(errors.password)}
              className="input h-12 bg-navy-950/50 pr-11 pl-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="icon-btn absolute top-1/2 right-2 -translate-y-1/2"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs text-rose-300">{errors.password[0]}</p>}
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-300 select-none">
          <input type="checkbox" name="remember" defaultChecked className="size-4 rounded accent-yellow-400" />
          Remember me
        </label>
        <button type="submit" className="btn btn-primary h-12 w-full text-base" disabled={pending}>
          {pending ? <LoaderCircle className="size-5 animate-spin" /> : <LogIn className="size-5" />}
          Login
        </button>
      </form>

      {demoMode && (
        <div className="mt-6 rounded-2xl border border-poke-sky/25 bg-poke-sky/[0.07] p-4">
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-poke-sky uppercase">
            <ShieldCheck className="size-4" /> Offline demo · fictional data
          </p>
          <form action={demoLoginAction} className="mt-3 grid grid-cols-2 gap-2">
            <button type="submit" name="as" value="admin" className="btn btn-blue btn-sm h-10">
              <ShieldCheck className="size-4" /> Demo Admin
            </button>
            <button type="submit" name="as" value="submitter" className="btn btn-ghost btn-sm h-10">
              <UserRound className="size-4" /> Demo Submitter
            </button>
          </form>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-300">
        New trainer?{" "}
        <Link href="/register" className="font-semibold text-poke-yellow hover:text-white">
          Create a submitter account
        </Link>
      </p>
    </>
  );
}
