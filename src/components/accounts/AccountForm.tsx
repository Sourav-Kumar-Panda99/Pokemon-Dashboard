"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { BadgeDollarSign, Bot, CircleCheck, Clock, Eye, EyeOff, KeyRound, LoaderCircle, Mail, NotebookPen, Plus, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { createAccountAction, updateAccountAction, type AccountFormState } from "@/app/actions/accounts";
import { CaptureBall } from "@/components/art/CaptureBall";
import { AccountStatusBadge } from "@/components/ui/Badges";
import { useToast } from "@/components/ui/Toast";
import { ACCOUNT_STATUSES, STATUS_META, TYPE_META } from "@/lib/constants";
import { formatAccountId } from "@/lib/format";
import type { AccountStatus, AccountType, Role } from "@/lib/types";

export interface AccountFormDefaults {
  id: number;
  type: AccountType;
  status: AccountStatus;
  loginEmail: string;
  ptcLogin: string | null;
  notes: string | null;
  askingPrice: number | null;
}

const TYPE_OPTIONS: Array<{ value: AccountType; icon: typeof Sparkles; hint: string; ring: string; chip: string }> = [
  { value: "NEW", icon: Sparkles, hint: "Freshly created account", ring: "peer-checked:border-sky-400 peer-checked:bg-sky-500/10 peer-checked:shadow-[0_0_30px_-10px_rgba(56,189,248,0.8)]", chip: "from-sky-300 to-sky-600" },
  { value: "BOT", icon: Bot, hint: "Bot / automation account", ring: "peer-checked:border-violet-400 peer-checked:bg-violet-500/10 peer-checked:shadow-[0_0_30px_-10px_rgba(167,139,250,0.8)]", chip: "from-violet-400 to-purple-700" },
  { value: "OLD", icon: Clock, hint: "Aged, established account", ring: "peer-checked:border-amber-400 peer-checked:bg-amber-500/10 peer-checked:shadow-[0_0_30px_-10px_rgba(251,191,36,0.8)]", chip: "from-amber-300 to-orange-600" },
];

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1.5 text-xs font-medium text-rose-300">{messages[0]}</p>;
}

function SecretInput({
  id,
  name,
  placeholder,
  required,
  invalid,
}: {
  id: string;
  name: string;
  placeholder: string;
  required?: boolean;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-500" />
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        spellCheck={false}
        maxLength={128}
        required={required}
        placeholder={placeholder}
        aria-invalid={invalid}
        className="input pr-11 pl-10 font-mono"
      />
      <button type="button" onClick={() => setVisible((v) => !v)} className="icon-btn absolute top-1/2 right-1.5 -translate-y-1/2" aria-label={visible ? "Hide value" : "Show value"}>
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function AccountForm({
  role,
  base,
  defaults,
}: {
  role: Role;
  base: "/admin" | "/dashboard";
  defaults?: AccountFormDefaults;
}) {
  const isEdit = Boolean(defaults);
  const isAdmin = role === "ADMIN";
  const router = useRouter();
  const toast = useToast();
  const action = defaults ? updateAccountAction.bind(null, defaults.id) : createAccountAction;
  const [state, formAction, pending] = useActionState<AccountFormState, FormData>(action, {});
  const [formKey, setFormKey] = useState(0);
  const [submitted, setSubmitted] = useState<AccountFormState | null>(null);
  // Drives the asking-price field, which only applies to NEW IDs.
  const [selectedType, setSelectedType] = useState<AccountType>(defaults?.type ?? "NEW");
  const errors = state.fieldErrors ?? {};

  // With JS, dispatch manually so React does not reset the fields when the
  // server returns validation errors. `action` stays as the no-JS fallback: the
  // form then POSTs to the server action, so secrets never land in the URL.
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };

  useEffect(() => {
    if (!state.ok) {
      if (state.error) toast.error(state.error);
      return;
    }
    if (isEdit) {
      toast.success("Changes saved");
      router.push(`${base}/accounts/${state.accountId}`);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show the success panel for this submission
      setSubmitted(state);
    }
  }, [state, isEdit, base, router, toast]);

  if (submitted?.ok && !isEdit) {
    const status = submitted.status ?? "PENDING";
    return (
      <div className="card relative overflow-hidden p-8 text-center animate-fade-up sm:p-12">
        <div className="map-grid pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto flex size-28 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-pulse-ring" />
          <CaptureBall size={88} />
          <span className="absolute -right-1 -bottom-1 inline-flex size-9 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-navy-850">
            <CircleCheck className="size-5" />
          </span>
        </div>
        <h2 className="relative mt-6 font-display text-2xl font-semibold text-white">Account submitted successfully.</h2>
        <p className="relative mt-2 text-sm text-slate-400">
          {formatAccountId(submitted.accountId)} has been added{status === "PENDING" ? " and is waiting for an admin." : " to the inventory."}
        </p>
        <div className="relative mt-4 flex items-center justify-center gap-2 text-sm text-slate-300">
          Status: <AccountStatusBadge status={status} />
          {status === "PENDING" && <span className="font-semibold text-yellow-200">Pending Review</span>}
        </div>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSubmitted(null);
              setSelectedType("NEW");
              setFormKey((k) => k + 1);
            }}
          >
            <Plus className="size-4" /> Submit another
          </button>
          <Link href={`${base}/accounts/${submitted.accountId}`} className="btn btn-ghost">
            View account
          </Link>
          <Link href={base} className="btn btn-ghost">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form key={formKey} action={formAction} onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]" noValidate>
      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <Mail className="size-5 text-poke-sky" /> Login Information
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="loginEmail" className="label">
                ID Login Mail
              </label>
              <input
                id="loginEmail"
                name="loginEmail"
                type="email"
                autoComplete="off"
                required
                defaultValue={defaults?.loginEmail}
                placeholder="trainer@example.com"
                aria-invalid={Boolean(errors.loginEmail)}
                className="input"
              />
              <FieldError messages={errors.loginEmail} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="loginPassword" className="label">
                Password
              </label>
              <SecretInput
                id="loginPassword"
                name="loginPassword"
                required={!isEdit}
                invalid={Boolean(errors.loginPassword)}
                placeholder={isEdit ? "Leave blank to keep the current password" : "Account password"}
              />
              <FieldError messages={errors.loginPassword} />
            </div>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <UserRound className="size-5 text-poke-yellow" /> PTC Information
            <span className="ml-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Optional</span>
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ptcLogin" className="label">
                PTC Login
              </label>
              <input
                id="ptcLogin"
                name="ptcLogin"
                autoComplete="off"
                spellCheck={false}
                maxLength={64}
                defaultValue={defaults?.ptcLogin ?? ""}
                placeholder="demo_ptc_user"
                aria-invalid={Boolean(errors.ptcLogin)}
                className="input font-mono"
              />
              <FieldError messages={errors.ptcLogin} />
            </div>
            <div>
              <label htmlFor="ptcPassword" className="label">
                PTC Password
              </label>
              <SecretInput
                id="ptcPassword"
                name="ptcPassword"
                invalid={Boolean(errors.ptcPassword)}
                placeholder={isEdit && defaults?.ptcLogin ? "Leave blank to keep" : "PTC password"}
              />
              <FieldError messages={errors.ptcPassword} />
            </div>
          </div>
          {isEdit && <p className="mt-3 text-xs text-slate-500">Clear the PTC login to remove PTC credentials from this account.</p>}
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-white">Account Type</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Account type">
            {TYPE_OPTIONS.map((option) => (
              <label key={option.value} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={option.value}
                  defaultChecked={(defaults?.type ?? "NEW") === option.value}
                  onChange={() => setSelectedType(option.value)}
                  className="peer sr-only"
                />
                <span className={`flex h-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 peer-focus-visible:outline-2 peer-focus-visible:outline-poke-yellow ${option.ring}`}>
                  <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${option.chip}`}>
                    <option.icon className="size-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-white">{TYPE_META[option.value].label}</span>
                    <span className="block text-xs text-slate-400">{option.hint}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
          <FieldError messages={errors.type} />

          {selectedType === "NEW" && (
            <div className="mt-5 rounded-2xl border border-sky-400/25 bg-sky-500/[0.06] p-4 animate-fade-up">
              <label htmlFor="askingPrice" className="flex items-center gap-2 text-sm font-semibold text-white">
                <BadgeDollarSign className="size-4 text-sky-300" /> Asking price
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  {isAdmin ? "Optional" : "Required"}
                </span>
              </label>
              <div className="relative mt-3 max-w-xs">
                <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold text-slate-400">$</span>
                <input
                  id="askingPrice"
                  name="askingPrice"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="1000000"
                  step="0.01"
                  required={!isAdmin}
                  defaultValue={defaults?.askingPrice ?? ""}
                  placeholder="0.00"
                  aria-invalid={Boolean(errors.askingPrice)}
                  aria-describedby="askingPrice-hint"
                  className="input pl-7 tabular-nums"
                />
              </div>
              <p id="askingPrice-hint" className="mt-2 text-xs text-slate-400">
                {isAdmin ? "The price this New ID should sell for." : "How much you want for this New ID. The admin sees it when reviewing your submission."}
              </p>
              <FieldError messages={errors.askingPrice} />
            </div>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <label htmlFor="notes" className="flex items-center gap-2 font-display text-lg font-semibold text-white">
            <NotebookPen className="size-5 text-slate-300" /> Notes
            <span className="ml-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">Optional</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            maxLength={1000}
            defaultValue={defaults?.notes ?? ""}
            placeholder="Level, region, special catches… Never paste passwords here."
            className="input mt-4 resize-y"
          />
          <FieldError messages={errors.notes} />
        </section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        {isAdmin && isEdit && defaults && (
          <div className="card p-5">
            <label htmlFor="status" className="label">
              Status
            </label>
            <select id="status" name="status" defaultValue={defaults.status} className="select">
              {ACCOUNT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">Changing the status records review / sale timestamps and notifies the submitter.</p>
          </div>
        )}
        {isAdmin && !isEdit && (
          <label className="card flex cursor-pointer items-start gap-3 p-5">
            <input type="checkbox" name="autoApprove" className="mt-0.5 size-4 accent-yellow-400" />
            <span>
              <span className="block text-sm font-semibold text-white">Approve immediately</span>
              <span className="block text-xs text-slate-400">Skip the review queue and list the account as Unsold.</span>
            </span>
          </label>
        )}

        <div className="card relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -top-10 -right-10 opacity-20">
            <CaptureBall size={120} />
          </div>
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="size-4 text-emerald-400" /> Secure storage
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
            <li>Passwords are encrypted with AES-256-GCM before they reach the database.</li>
            <li>They are masked everywhere and only admins can reveal them — every reveal is logged.</li>
            {!isAdmin && <li>You can edit a submission until it has been reviewed.</li>}
          </ul>
        </div>

        {state.error && !state.ok && (
          <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {state.error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button type="submit" className="btn btn-primary h-12 text-base" disabled={pending}>
            {pending ? <LoaderCircle className="size-5 animate-spin" /> : isEdit ? <CircleCheck className="size-5" /> : <Plus className="size-5" strokeWidth={3} />}
            {isEdit ? "Save Changes" : "Submit Account"}
          </button>
          <Link href={isEdit && defaults ? `${base}/accounts/${defaults.id}` : base} className="btn btn-ghost">
            Cancel
          </Link>
        </div>
      </aside>
    </form>
  );
}
