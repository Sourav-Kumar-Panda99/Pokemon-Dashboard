import { z } from "zod";
import { ACCOUNT_STATUSES, ACCOUNT_TYPES, DEFAULT_PAGE_SIZE, PAGE_SIZES, SORT_KEYS, type SortKey } from "./constants";
import type { AccountStatus, AccountType } from "./types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((value) => (value ? value : undefined));

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal(""), z.null(), z.undefined()])
  .transform((value) => value === "on" || value === "true" || value === "1");

export const emailField = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address").max(254));

// Account credentials are third-party secrets: keep them byte-exact, only cap length.
const secretField = z.string().max(128, "Must be 128 characters or fewer");

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password").max(128),
  remember: checkbox,
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your name").max(80),
    email: emailField,
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(72, "Use 72 characters or fewer")
      .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), "Mix letters and numbers"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(72, "Use 72 characters or fewer")
      .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), "Mix letters and numbers"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name").max(80),
});

const ptcLoginField = z
  .string()
  .trim()
  .max(64, "Must be 64 characters or fewer")
  .regex(/^\S*$/, "PTC login cannot contain spaces")
  .optional()
  .transform((value) => (value ? value : undefined));

// Asking price in USD; only meaningful for NEW IDs (ignored for other types).
const askingPriceField = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "Enter a valid price" });
      return z.NEVER;
    }
    return Math.round(price * 100) / 100;
  });

const accountBase = {
  type: z.enum(ACCOUNT_TYPES as [AccountType, ...AccountType[]], { message: "Choose an account type" }),
  loginEmail: emailField,
  ptcLogin: ptcLoginField,
  notes: optionalText(1000),
  askingPrice: askingPriceField,
};

export const accountCreateSchema = z
  .object({
    ...accountBase,
    loginPassword: secretField.min(1, "Enter the account password"),
    ptcPassword: secretField.optional().transform((value) => (value ? value : undefined)),
    autoApprove: checkbox,
  })
  .refine((value) => !value.ptcLogin || value.ptcPassword, {
    path: ["ptcPassword"],
    message: "Enter the PTC password",
  })
  .refine((value) => value.ptcLogin || !value.ptcPassword, {
    path: ["ptcLogin"],
    message: "Enter the PTC login for this password",
  });

export const accountUpdateSchema = z.object({
  ...accountBase,
  // Blank means "keep the stored password".
  loginPassword: secretField.optional().transform((value) => (value ? value : undefined)),
  ptcPassword: secretField.optional().transform((value) => (value ? value : undefined)),
  status: z
    .enum(ACCOUNT_STATUSES as [AccountStatus, ...AccountStatus[]])
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const idListSchema = z.array(z.number().int().positive()).min(1, "Select at least one account").max(500);

export const statusActionSchema = z.object({
  ids: idListSchema,
  action: z.enum(["APPROVE", "REJECT", "MARK_SOLD", "MARK_UNSOLD"]),
  price: z.number().min(0).max(1_000_000).nullable().optional(),
  reason: z.string().trim().max(300).optional(),
});

export function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

export function formValues(formData: FormData, keys: string[]) {
  const out: Record<string, string | undefined> = {};
  for (const key of keys) {
    const value = formData.get(key);
    out[key] = typeof value === "string" ? value : undefined;
  }
  return out;
}

// --- URL query parsing ----------------------------------------------------------

export type SearchParams = Record<string, string | string[] | undefined>;

export interface AccountQuery {
  q?: string;
  type?: AccountType;
  status?: AccountStatus;
  submitter?: string;
  from?: string;
  to?: string;
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
  size: number;
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
const isoDate = (value: string | undefined) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined);
const uuid = (value: string | undefined) => (value && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined);

export function parseAccountQuery(params: SearchParams, defaults: Partial<AccountQuery> = {}): AccountQuery {
  const type = one(params.type)?.toUpperCase();
  const status = one(params.status)?.toUpperCase();
  const sort = one(params.sort);
  const dir = one(params.dir);
  const page = Number.parseInt(one(params.page) ?? "1", 10);
  const size = Number.parseInt(one(params.size) ?? "", 10);
  return {
    q: one(params.q)?.slice(0, 100) ?? defaults.q,
    type: ACCOUNT_TYPES.includes(type as AccountType) ? (type as AccountType) : defaults.type,
    status: ACCOUNT_STATUSES.includes(status as AccountStatus) ? (status as AccountStatus) : defaults.status,
    submitter: uuid(one(params.submitter)) ?? defaults.submitter,
    from: isoDate(one(params.from)) ?? defaults.from,
    to: isoDate(one(params.to)) ?? defaults.to,
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : (defaults.sort ?? "created_at"),
    dir: dir === "asc" || dir === "desc" ? dir : (defaults.dir ?? "desc"),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 100_000) : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? size : (defaults.size ?? DEFAULT_PAGE_SIZE),
  };
}

export function parsePage(params: SearchParams): number {
  const page = Number.parseInt(one(params.page) ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? Math.min(page, 100_000) : 1;
}

export function parseText(params: SearchParams, key: string, max = 100): string | undefined {
  return one(params[key])?.slice(0, max);
}

export function parseDate(params: SearchParams, key: string): string | undefined {
  return isoDate(one(params[key]));
}
