# Agentic Dish — agentic restaurant website

A restaurant site where **conversation replaces clicking**. Customers browse a normal menu *or* tell the AI host
"add one paneer masala dosa to my cart"; the owner asks "which dish is performing best?" and gets charts, or
"mark idli out of stock" and gets a Confirm card.

Built from `specs.md`: Next.js 15 (App Router) · Tailwind v4 · CopilotKit (AG-UI, v2 API) · DeepSeek · Supabase
(Postgres, Auth, Realtime, Storage, RLS) · Razorpay · Recharts · Zod · Resend · Supabase pg_cron · Vitest · Playwright.

## Golden rules → where they're enforced

| Rule | Enforcement |
|---|---|
| AI never pays | No payment tool exists. `prepare_checkout` creates an `awaiting_payment` order + Razorpay order and renders a **Pay** button only a human can click (`components/chat/PayButton.tsx`). A DB trigger (`guard_order_status`) rejects any move to `paid`/`refunded`/`payment_failed` outside the webhook RPCs, even for the service role. `tests/unit/payment-safety.test.ts` walks the import graph of `lib/agents/**`; `tests/integration/db.test.ts` proves the trigger. |
| Typed tools only | Every capability is a Zod-validated tool (`lib/agents/*/tools.ts`, `changes.ts`, `confirm.ts`) run through `guard.runTool` (role check → validation → handler → audit). No SQL from the model; analytics are `security definer` RPCs. |
| Server-side money math | `lib/pricing.ts#computeCartTotals` is the only price/discount/tax code; used by cart page, agent, checkout and order creation. |
| Owner writes need a click | Owner write tools are human-in-the-loop: the model proposes, a **Confirm card** shows a server-computed before → after diff, and only the Confirm button's server action executes it (`app/actions/owner.ts#executeOwnerChange`). |
| Role separation | Roles are read from `profiles` server-side on every call (`lib/auth.ts`, `lib/agents/runtime.ts`). Staff are limited by `STAFF_ALLOWED_TOOLS` in `lib/agents/guard.ts`; RLS protects direct client access. |

## Architecture

```
app/(public)     home, /menu, /menu/[slug], /about, /contact
app/(auth)       /login (email+password, phone OTP, Google), /signup, /reset-password, /update-password
app/(customer)   /cart /checkout /orders /orders/[id] /reservations /profile /favorites   (login required)
app/(owner)      /owner (chat-first + KPI strip + alerts bell), /owner/orders (live kanban), /owner/menu, /owner/settings
app/api/copilot/{customer,owner}/[[...path]]   CopilotKit v2 runtime (per-request BuiltInAgent bound to the verified user)
app/api/payments/{create-order,verify,webhook} Razorpay
app/api/cron/{daily-summary,alerts,expire-unpaid}
app/api/owner/report                           CSV / PDF reports
lib/services/*   the single service layer used by BOTH the manual UI (server actions) and agent tools
lib/agents/*     tools, prompts, guard, runtime, mock model
supabase/        migrations (schema, RLS, analytics RPCs) + seed (59 dishes, 90 days of orders)
```

**Same state, two paths.** Cart, orders, reservations, favourites and owner changes all go through
`lib/services/*`. The header cart badge and cart page subscribe to Supabase Realtime on `cart_items`, so an
agent-made change shows instantly.

**Generative UI.** Backend tool results render as cards via `renderToolCalls` (dish carousels, cart summary,
combo "Add all", checkout + Pay, order timeline, KPI cards, line/bar/donut charts, weekday×hour heatmap,
sortable tables with CSV export, comparison cards, reports, alerts). Confirm-gated actions use `humanInTheLoop`.

**Prompt-injection hardening.** User-written text (reviews, notes, special instructions) is wrapped in
`<user_text>` tags by `wrapUntrustedFields` and both system prompts say to treat it as data.

### Note on CopilotKit / DeepSeek
CopilotKit 1.79 deprecates the v1 `OpenAIAdapter` runtime; this build uses the v2 runtime (`BuiltInAgent`) with
the AI SDK OpenAI provider pointed at `DEEPSEEK_BASE_URL` — the same OpenAI-compatible setup, non-deprecated.
The model id comes from `DEEPSEEK_MODEL` (default `deepseek-flash`).

## Setup

1. **Install** — Node 20+.
   ```bash
   npm install
   ```
2. **Supabase** — create a project, then copy `.env.example` → `.env.local` and fill
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL`
   (Project Settings → Database → connection string).
3. **Migrations + seed**
   ```bash
   npm run db:setup
   ```
   (or `npm run db:migrate` then `npm run db:seed`; `supabase db push` also works since files live in `supabase/migrations`).
   The seed creates demo logins — **test credentials only**:

   | Role | Email | Password |
   |---|---|---|
   | Owner | owner@example.com | Owner@12345 |
   | Staff | staff@example.com | Staff@12345 |
   | Customer (peanut allergy, has a "usual") | customer@example.com | Customer@12345 |

4. **Auth providers** — Email is on by default. For phone OTP enable an SMS provider; for Google enable the
   provider and add `<site>/auth/callback` to redirect URLs (Authentication → URL configuration).
5. **DeepSeek** — set `DEEPSEEK_API_KEY` (or `LLM_MOCK=1` to use the scripted model).
6. **Razorpay (test mode)** — set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`. Create a
   webhook for `payment.captured`, `payment.failed`, `refund.processed` pointing to
   `<site>/api/payments/webhook` and put its secret in `RAZORPAY_WEBHOOK_SECRET`. Locally, expose the dev server
   with a tunnel (`cloudflared tunnel --url http://localhost:3000` or ngrok) so webhooks arrive. If a webhook is
   missed, the `expire-unpaid` cron reconciles with Razorpay's API before expiring an order.
7. **Cron + optional extras** — `CRON_SECRET` is **required**: every `/api/cron/*` route returns 401 without it, and
   it must equal the `cron_secret` stored in Supabase Vault (see [Deploying](#deploying-vercel)). Optional:
   `RESEND_API_KEY` + `OWNER_ALERT_EMAIL` for emails (otherwise logged). A public Storage bucket named `dishes` is
   created on first image upload.
8. **Run**
   ```bash
   npm run dev
   ```

## Scripts

| Script | What it does |
|---|---|
| `dev` / `build` / `start` | Next.js |
| `lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `test` | Vitest: pricing, coupons, opening hours, IST date ranges, role guard, every tool's Zod schema, webhook signature + idempotency, payment-safety import scan, a real `BuiltInAgent` run with the mock model, and DB integration on PGlite (real Postgres in WASM: migrations + seed + triggers + analytics) |
| `test:e2e` | Playwright: every flow in spec §6.4 and §7.5 against a seeded Supabase with `LLM_MOCK=1` (set `E2E_LIVE_LLM=1` for a live-model smoke run) |
| `db:migrate` / `db:seed` / `db:setup` | Apply SQL to `SUPABASE_DB_URL` |
| `db:verify` | Run migrations + seed + payment-safety assertions offline on PGlite (no Supabase needed) |

## Deploying (Vercel)
Scheduling is done by **Supabase pg_cron** (via `pg_net`, calling the `/api/cron/*` routes over HTTP), not Vercel
Cron — `vercel.json` has no crons, so the deploy stays within the Hobby plan. The jobs are daily summary (02:30 UTC
= 08:00 IST), hourly alerts, and unpaid-order expiry every 10 minutes.

1. In Vercel, set the env vars from `.env.example` including `CRON_SECRET` and `NEXT_PUBLIC_SITE_URL` (your deployed
   URL, no trailing slash). Recommended: also set `EMAIL_UNSUBSCRIBE_SECRET` — `lib/bulk-email/unsubscribe.ts` falls
   back to `CRON_SECRET`, so giving it its own value keeps unsubscribe links working when `CRON_SECRET` is rotated.
2. In `supabase/cron-setup.sql`, replace the `REPLACE_WITH_YOUR_SITE_URL` and `REPLACE_WITH_YOUR_CRON_SECRET`
   placeholders, then run the file once in the Supabase SQL Editor. `cron_secret` must equal the `CRON_SECRET` set in
   Vercel.
3. Verify with the queries at the bottom of `supabase/cron-setup.sql`: `select * from cron.job;`,
   `select * from cron.job_run_details order by start_time desc limit 20;` and
   `select id, status_code, error_msg, created from net._http_response order by created desc limit 20;`.
   To remove the schedules, run the commented "undo" block at the end of that file.

## Voice-ready seams (§14)
All capabilities are tools; `useChatActions().submitUserMessage(text)` is the single entry point for any input
source; the chat panel has an empty `data-slot="mic"` and CopilotKit's input exposes a `startTranscribeButton`
slot; agent replies are plain text + cards.
