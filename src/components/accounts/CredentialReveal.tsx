"use client";

import { Check, Copy, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { revealCredentialAction } from "@/app/actions/accounts";
import { useToast } from "@/components/ui/Toast";
import { REVEAL_TIMEOUT_MS } from "@/lib/constants";
import type { CredentialField } from "@/lib/types";

const MASK = "••••••••";

/**
 * Masked secret. Admins can reveal it — the plaintext is fetched on demand
 * from an audited server action and re-masked automatically.
 */
export function CredentialReveal({
  accountId,
  field,
  canReveal,
  present = true,
  size = "sm",
}: {
  accountId: number;
  field: CredentialField;
  canReveal: boolean;
  present?: boolean;
  size?: "sm" | "md";
}) {
  const [value, setValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!present) return <span className="text-slate-600">—</span>;

  const hide = () => {
    setValue(null);
    if (timer.current) clearTimeout(timer.current);
  };

  const reveal = () =>
    startTransition(async () => {
      const result = await revealCredentialAction(accountId, field);
      if (!result.ok) {
        toast.error("Could not reveal credential", result.error);
        return;
      }
      setValue(result.data?.value ?? "");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setValue(null), REVEAL_TIMEOUT_MS);
    });

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const label = field === "login_password" ? "password" : "PTC password";
  const text = size === "md" ? "text-sm" : "text-[13px]";

  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <span
        className={`truncate font-mono ${text} ${value !== null ? "rounded-md bg-poke-yellow/10 px-1.5 py-0.5 text-yellow-100 ring-1 ring-poke-yellow/25" : "tracking-wider text-slate-400"}`}
        aria-label={value !== null ? `${label} revealed` : `${label} hidden`}
      >
        {value !== null ? value || "(empty)" : MASK}
      </span>
      {canReveal && (
        <button
          type="button"
          className="icon-btn size-7 shrink-0"
          onClick={value !== null ? hide : reveal}
          disabled={pending}
          aria-label={value !== null ? `Hide ${label}` : `Reveal ${label}`}
          title={value !== null ? `Hide ${label}` : `Reveal ${label} (audited)`}
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : value !== null ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      )}
      {value !== null && (
        <button type="button" className="icon-btn size-7 shrink-0" onClick={copy} aria-label={`Copy ${label}`} title="Copy">
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
        </button>
      )}
    </span>
  );
}
