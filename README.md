# GO Account Manager

A Pokémon GO–themed account inventory dashboard. **Admins** manage the whole inventory (review, approve, sell, export, manage users, audit), while **submitters** submit accounts and track only their own.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Supabase (Auth + Postgres) and Lucide icons.

---

## Quick start — offline demo (no setup)

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase credentials, `npm run dev` starts an **embedded Postgres (PGlite)** that runs the *same* Supabase migrations and seeds 250 fictional accounts (85 New / 95 Bot / 70 Old · 70 Sold / 175 Pending / 5 Rejected).

Use the **Demo Admin** / **Demo Submitter** buttons on the login page, or sign in with:

| Role      | Email                   | Password                                  |
| --------- | ----------------------- | ----------------------------------------- |
| Admin     | `admin@example.com`     | `go-demo-2026` (override with `DEMO_PASSWORD`) |
| Submitter | `submitter@example.com` | same                                      |

All demo emails use the reserved `example.com` domain and every credential is random gibberish. Demo data lives in `.data/` (git-ignored); `npm run demo:reset` wipes it so it is re-seeded on the next start.

To try the production build offline: `npm run build && npm run start:demo`.

---

## Production setup (Supabase)

1. **Create a Supabase project.**
2. **Apply the schema**: run every file in `supabase/migrations/` **in filename order** in the SQL editor (or `supabase db push` with the Supabase CLI). Already set up? Run only the files you haven't run yet, oldest first (`20261002000000_asking_price.sql`, `20261003000000_direct_sale.sql`, then `20261004000000_remove_unsold_approved.sql`).
3. **Configure env**: `cp .env.example .env.local`, then fill in
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   - `CREDENTIALS_ENCRYPTION_KEY` — generate with `npm run gen:key` and **back it up** (without it stored passwords cannot be decrypted)
   - optional `SUPABASE_SERVICE_ROLE_KEY` (bans disabled users at the auth layer; needed for seeding)
   - `SITE_URL` (email confirmation links point to `/auth/confirm`)
4. **Create your admin**: register through `/register`, then promote yourself once in the SQL editor:
   ```sql
   update public.profiles set role = 'ADMIN' where email = 'you@yourdomain.com';
   ```
   New sign-ups are always submitters; roles are never taken from user input.
5. **Optional demo data**: `npm run db:seed` (refuses to run if accounts already exist; `-- --force` to override).
6. `npm run build && npm start`.

In Supabase → Authentication → URL configuration, add `SITE_URL/auth/confirm` as a redirect URL.

---

## Security model

| Layer | What it does |
| --- | --- |
| **Proxy** (`src/proxy.ts`) | Refreshes Supabase sessions and redirects anonymous users away from `/admin` and `/dashboard`. Optimistic only. |
| **Layouts / pages** | `requireAdmin()` / `requireUser()` verify the session server-side (`supabase.auth.getUser()`) and the role on every request. |
| **Server actions** | Each action re-checks auth + role, validates input with Zod and rate-limits sensitive operations (login, register, reveal, import, export, password change). |
| **Postgres RLS** | Every table has RLS. Submitters can only read their own accounts, credentials metadata and history; admins read everything. Disabled users read nothing. |
| **Write functions** | Clients have **no** INSERT/UPDATE/DELETE grants. All mutations go through `SECURITY DEFINER` functions that check the caller's role, enforce the status workflow and write the audit log atomically. |
| **Credential storage** | Passwords are encrypted with **AES-256-GCM** in the app server before they reach the database. Ciphertext columns are not selectable by API roles (column privileges) — not even by admins through the REST API. Admins decrypt one value at a time via an audited, rate-limited server action; the plaintext auto-hides after 30 s. |
| **Audit log** | Append-only `account_activity` (no API role can update/delete it). It records reveals and exports but never secrets. |
| **Last admin guard** | A trigger makes it impossible to demote, disable or delete the last active admin. |
| **Browser** | Session cookies are HttpOnly + SameSite=Lax. Strict security headers (CSP, `frame-ancestors 'none'`, nosniff…). The browser never talks to Supabase directly, and no key or secret is shipped in client bundles. |

Rate limiting is in-memory (per server instance). For multi-instance deployments, back `src/lib/server/rate-limit.ts` with Redis/Upstash.

---

## Data model

`supabase/migrations/20261001000000_init.sql`

- `profiles` — app users (1:1 with `auth.users`): name, email, role (`ADMIN` / `SUBMITTER`), active flag
- `accounts` — type (`NEW` / `BOT` / `OLD`), status (`PENDING` / `SOLD` / `REJECTED`), notes, asking price (New IDs only; required from submitters), review & sale stamps
- `account_credentials` — login email, PTC login, **encrypted** password + PTC password
- `account_activity` — audit trail with `account_ref` that survives deletion
- `sales` — sale records (price optional; voided when marked unsold)
- `notifications` — submitter notifications (approved / rejected / sold)

Statuses: **PENDING** (in stock) → **SOLD** (with the sold price) or **REJECTED**. Setting a sold account back to Pending from the edit form voids its sale.

Indexes cover status/type/submitter/date filters and trigram (`pg_trgm`) search on login email, PTC login and submitter name.

---

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server (offline demo DB when Supabase isn't configured) |
| `npm run build` / `npm start` | Production build / server |
| `npm run start:demo` | Production server against the offline demo DB |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run test:db` | **Database security test-suite**: applies the real migrations to an in-memory Postgres and checks RLS isolation, admin-only functions, ciphertext column lockdown, workflow transitions, last-admin guard, import/export and the seed |
| `npm run db:seed` | Seed a Supabase project with fictional demo data |
| `npm run demo:reset` | Delete the offline demo database |
| `npm run gen:key` | Generate a `CREDENTIALS_ENCRYPTION_KEY` |

---

## Project structure

```
src/
  proxy.ts                     session refresh + optimistic route gating
  app/
    (auth)/login, register     full-screen map login / registration
    admin/…                    admin dashboard, accounts, pending, users, sales, activity, settings
    dashboard/…                submitter dashboard, submit, history, settings
    actions/                   server actions (auth, accounts, users)
    auth/confirm               Supabase email-confirmation handler
  components/
    art/                       original SVG artwork (map scenes, mascot, capture ball, empty states)
    accounts/                  AccountTable, FilterBar, AccountForm, AccountDetailView, PendingReview, …
    layout/                    AppShell, Sidebar, Header
    ui/                        StatCard, badges, ConfirmDialog, Modal, Toast, Pagination, skeletons, EmptyState
  lib/
    server/                    session, RPC dispatcher, repository, encryption, rate limiting (server-only)
    local-db/                  PGlite runner used by demo mode and tests
    crypto/credentials.ts      AES-256-GCM helpers
    demo/generate.ts           deterministic fictional demo data
supabase/
  migrations/                  schema, RLS, functions, grants
  dev/pglite-shim.sql          local-only emulation of Supabase's auth schema/roles
scripts/                       test-db, seed-supabase, demo helpers
```

---

## Artwork & trademarks

All illustrations (map scenes, gyms, stops, the "Sparky" mascot, the capture ball, creature silhouettes) are **original SVG artwork** drawn for this project — no official Pokémon assets are included. Pokémon and Pokémon GO are trademarks of Nintendo, Creatures Inc., GAME FREAK inc. and Niantic; this project is not affiliated with or endorsed by them. Trading game accounts may violate the game's Terms of Service — make sure your use complies with them.
