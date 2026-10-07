"use client";

import { useActionState } from "react";
import { CircleCheck, KeyRound, LoaderCircle, UserRound } from "lucide-react";
import { changePasswordAction, updateProfileAction, type SettingsFormState } from "@/app/actions/users";

function Status({ state }: { state: SettingsFormState }) {
  if (state.ok && state.message)
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-emerald-300">
        <CircleCheck className="size-4" /> {state.message}
      </p>
    );
  if (state.error)
    return (
      <p role="alert" className="text-sm text-rose-300">
        {state.error}
      </p>
    );
  return null;
}

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="fullName" className="label">
          Display name
        </label>
        <input id="fullName" name="fullName" defaultValue={fullName} maxLength={80} required className="input" aria-invalid={Boolean(state.fieldErrors?.fullName)} />
        {state.fieldErrors?.fullName && <p className="mt-1.5 text-xs text-rose-300">{state.fieldErrors.fullName[0]}</p>}
      </div>
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input id="email" value={email} disabled className="input opacity-60" />
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <UserRound className="size-4" />} Save profile
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(changePasswordAction, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      {(
        [
          ["currentPassword", "Current password", "current-password"],
          ["newPassword", "New password", "new-password"],
          ["confirmPassword", "Confirm new password", "new-password"],
        ] as const
      ).map(([name, label, autoComplete]) => (
        <div key={name}>
          <label htmlFor={name} className="label">
            {label}
          </label>
          <input id={name} name={name} type="password" autoComplete={autoComplete} required className="input" aria-invalid={Boolean(errors[name])} />
          {errors[name] && <p className="mt-1.5 text-xs text-rose-300">{errors[name]![0]}</p>}
        </div>
      ))}
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-blue" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Change password
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}
