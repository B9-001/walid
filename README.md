# Diamond Taste — E-commerce Storefront + Admin

A **Next.js 16 (App Router)** storefront and admin dashboard for a Nigerian cake/bakery business:
browse products, add to cart, pay with **Paystack**, track orders, and manage everything from a
built-in `/admin` dashboard. Backed by **Supabase** (Postgres + Auth + Storage). Rebrand it and
launch your own shop — see [SETUP-GUIDE.md](./SETUP-GUIDE.md) for a full walkthrough.

> This document is a from-the-code audit of what's actually implemented, what's wired up but
> missing its database objects, and what was completed in this pass. For the original
> quick-start, see [QUICKSTART.md](./QUICKSTART.md) / [SETUP-GUIDE.md](./SETUP-GUIDE.md).

---

## 1. Framework & stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16** (App Router, React Server + Client Components) |
| UI | **React 19**, **TypeScript**, **Tailwind CSS v4**, `framer-motion` |
| Database / Auth / Storage | **Supabase** (`@supabase/supabase-js` v2) — Postgres + Row-Level Security, Supabase Auth, Supabase Storage |
| Payments | **Paystack** inline checkout (card, bank transfer, USSD) |
| Serverless functions | **Supabase Edge Functions** (Deno) for email, webhooks, and optional AI/bot features |
| Transactional email | **Resend** (via edge functions), optional |
| Analytics | First-party event logging into Postgres, plus optional **Facebook/Meta Pixel + Conversions API** |
| Money | Stored as **integer kobo** (₦ × 100) everywhere; formatted with `lib/format.ts` |

There is **no tRPC, Drizzle, or Vite runtime in the running app**, despite those dependencies/config
files being present in the repo — see [§4 Inherited scaffold cruft](#4-inherited-scaffold-cruft-not-part-of-the-app).

## 2. Project structure

```
app/                      Next.js App Router pages
  page.tsx                Home (hero, featured products, categories, testimonials)
  shop/ product/ cart/     Storefront: browse, product detail, cart
  checkout/ order-success/ track/   Checkout (Paystack), confirmation, order tracking
  bundles/ offer1/         Bundle/offer landing pages + their own mini-cart
  about/ contact/ refer/   Static-ish content pages + the referral program page
  auth/                    Supabase auth callback + password reset pages
  control/                 Password-gated first-party analytics dashboard
  admin/                   Admin dashboard (protected by diamond_admins allowlist)
    products/ categories/ orders/ coupons/ delivery/ hero/ settings/  Management screens
    crm/                   Customer pipeline, customer list, email dashboard
    login/                 Admin sign-in
  api/                     Route handlers: analytics summary, Meta Conversions API relay
components/diamond/        All storefront + shared UI (Navbar, Hero, ProductCard, CartView, …)
  admin/                   Admin-only components (PipelineBoard, CustomersTable, EmailStats, …)
lib/                       Business logic: supabase client, cart, coupons, paystack, auth,
                            referral, tracking, analytics, stock, format, etc. — no server framework,
                            these are called directly from client components via the Supabase JS SDK
supabase/functions/        Supabase Edge Functions (Deno): order emails, Paystack webhooks,
                            unsubscribe, and the optional AI email/Instagram-bot functions
public/                    Static assets — logo, favicon, product/hero images
schema.sql                 Core database schema — run this first in Supabase SQL Editor
schema-crm-extensions.sql  Added in this pass — see §5
.env.example               Added in this pass — see §5
next.config.ts              Image remote-pattern config (Supabase storage hostname)
```

## 3. Dependencies

Runtime (`package.json`):
`next` 16, `react`/`react-dom` 19, `@supabase/supabase-js` 2, `framer-motion`, `browser-image-compression`.

Dev: `typescript`, `eslint` 9 + `eslint-config-next`, `tailwindcss` v4 + `@tailwindcss/postcss`.

That's the entire dependency surface of the actual app — deliberately minimal. There is no ORM, no
server framework, and no state-management library; Supabase's JS client is called directly from
client components, and the cart is plain `localStorage` (`lib/cart.tsx`).

## 4. Inherited scaffold cruft (not part of the app)

The exported project also contains a `client/`, `server/`, `shared/`, `drizzle/` directory tree,
plus `vite.config.ts`, `vitest.config.ts`, and a tRPC router (`server/routers.ts`) with one test
(`server/auth.logout.test.ts`). This is leftover boilerplate from the AI web-dev scaffold this
project was originally generated from (see `client/public/__manus__/`) — **nothing under `app/`,
`lib/`, or `components/` imports from any of them** (verified by grep). `package.json` has no tRPC
or Drizzle dependency at all, so none of it can even build as part of the running app.

They're left in place rather than deleted here since removing a whole directory tree is a bigger
call than an unsolicited audit should make, but a future cleanup pass can safely delete:
`client/`, `server/`, `shared/`, `drizzle/`, `vite.config.ts`, `vite.config.ts.bak`,
`vitest.config.ts`, `drizzle.config.ts`, `template.json`, `tsconfig.tsbuildinfo`.

## 5. Database

### Tables (`schema.sql`)
`diamond_categories`, `diamond_products`, `diamond_orders`, `diamond_coupons`,
`diamond_hero_images`, `diamond_site_settings`, `diamond_delivery_fees`, `diamond_customers`,
`diamond_admins`, `diamond_analytics_events`, `diamond_email_log` — all prefixed `diamond_`, all
with permissive RLS (`using (true) with check (true)`) so the public anon key can read the store
and write orders. Two functions ship with it: `diamond_product_sales()` (best-seller ranking) and
`diamond_lookup_customer()` (checkout email lookup).

### `schema-crm-extensions.sql` — added in this pass
Auditing the app code against `schema.sql` turned up several features that are **fully built in
the UI and already call Supabase for data that no table/function in `schema.sql` provides** —
i.e. they'd throw errors in a fresh install. This new file (run it after `schema.sql`) adds
exactly what's missing for those features, and only those:

- **Customer pipeline & on-site behaviour tracking** — `lib/track.ts` and the admin CRM's
  `PipelineBoard`/`CustomersTable`/`CustomerDetail` read/write `diamond_customers` columns
  (`last_viewed_at`, `last_added_at`, `last_checkout_at`, `stage_locked`, …) that didn't exist,
  and nothing kept `orders_count`/`total_spent`/`lifecycle_stage` in sync with `diamond_orders` —
  those fields were always read-only from the client, so they'd sit at their defaults forever.
  Adds the columns, a `diamond_recompute_customer_stage()` function (thresholds taken from the
  tag descriptions in `lib/segments.ts`), and an `AFTER INSERT OR UPDATE` trigger on
  `diamond_orders` that keeps everything current and calls `diamond_resync_crm()`'s logic
  (the "↺ Re-sync" button in `/admin/crm`).
- **Referral program** (`app/refer`, `lib/referral.ts`) — adds `diamond_attribute_referral()`
  (attaches a signup to whoever's link they arrived with), `diamond_referral_progress()` (how
  many referred customers have ordered), and `diamond_check_referral_reward()` (grants a
  redeemable "free milk cake" coupon once the referral goal is hit — fired from the orders
  trigger above).
- **`/control` analytics dashboard** (`app/control`, `app/api/analytics/route.ts`) — adds
  `diamond_analytics_summary(p_days)`, aggregating `diamond_analytics_events` (already logged by
  `lib/analytics.ts` on every page view/click/exit) into the exact shape the dashboard expects.

**Deliberately not covered** — the AI email broadcaster, sequence runner, and Instagram bot
(`supabase/functions/diamond-ai-broadcast`, `diamond-sequence-runner`, `diamond-crm-email`,
`diamond-generate-sequence`, `diamond-ig-bot`, `diamond-follow-up`, `diamond-broadcast-email`,
`diamond-compose-email`, `diamond-resend-webhook`, `diamond-unsubscribe`) call roughly a dozen
more tables (`diamond_ai_broadcasts`, `diamond_ai_learnings`, `diamond_bot_sessions`,
`diamond_bot_messages`, `diamond_bot_complaints`, `diamond_bot_payments`,
`diamond_sequence_steps`, `diamond_email_sends`, `diamond_email_events`,
`diamond_email_send_state`, `diamond_email_send_failures`, `diamond_email_unsubscribes`) and RPCs
(`diamond_email_stats`, `diamond_step_recipients`, `diamond_broadcast_recipients`,
`diamond_revive_stage_into_step`, `diamond_record_email_failure`) that aren't in `schema.sql`
either. `SETUP-GUIDE.md` already flags this whole group as advanced/optional ("treat these as a
bonus, not a starting point") and it depends on an `OPENROUTER_API_KEY` and product decisions
(tone, tier thresholds, sending cadence) that belong to whoever picks it up — see
[§7 Known gaps](#7-known-gaps--unfinished-features) below.

### `.env.example` — added in this pass
Both `README.md` and `SETUP-GUIDE.md` instruct `cp .env.example .env.local`, but the file didn't
exist in the export. Added, listing every `process.env.*` the Next.js app actually reads
(`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`/`SUBACCOUNT_CODE`, `NEXT_PUBLIC_SITE_URL`, `CONTROL_PASSWORD`,
`NEXT_PUBLIC_FB_PIXEL_ID`, `FB_CAPI_TOKEN`), plus a commented-out reference list of the Deno
secrets the edge functions expect (`DT_RESEND_API_KEY`, `DT_PAYSTACK_SECRET`,
`OPENROUTER_API_KEY`, etc. — those are set as Supabase project secrets, not in `.env.local`).

## 6. Authentication

Two independent auth surfaces, both on **Supabase Auth**:

- **Customers** (`lib/auth.tsx`, `components/diamond/LoginPrompt.tsx`) — email/password sign-up
  and sign-in, password reset (`app/auth/reset`), no email confirmation required (instant
  session). On every auth state change, the signed-in user is upserted into `diamond_customers`
  by email — which also claims any existing guest-checkout row with the same email — and any
  pending referral code is attributed.
- **Admin** (`app/admin/login`, `app/admin/layout.tsx`) — same Supabase Auth, but access to
  `/admin` is gated by an allowlist: a user's `auth.users` UUID must exist in `diamond_admins`
  (added manually via SQL — see `SETUP-GUIDE.md` Step 6). There's no self-service admin sign-up.
- **`/control`** (`app/control/page.tsx`) is a third, much lighter gate: a single shared password
  (`CONTROL_PASSWORD` env var) checked server-side in `app/api/analytics/route.ts` — not
  Supabase Auth, and not tied to any user account.

## 7. APIs

**Next.js route handlers** (`app/api/`):
- `GET /api/analytics?key=…&days=…` — password-gated (`CONTROL_PASSWORD`) analytics summary for
  `/control`, reads via the service-role client.
- `POST /api/capi` — relays browser events to the Meta/Facebook Conversions API server-side
  (hashes email/phone, attaches IP + `fbp`/`fbc` cookies).

**Supabase Edge Functions** (`supabase/functions/`, Deno, deployed separately):
| Function | Purpose |
|---|---|
| `diamond-paystack-webhook`, `central-paystack-webhook` | Server-side backstop that confirms payment even if the customer closes the tab mid-checkout |
| `diamond-order-status-email` (+ `trigger.sql`) | Emails the customer whenever `diamond_orders.status` changes (DB trigger → edge function → Resend) |
| `diamond-resend-webhook`, `diamond-unsubscribe` | Resend delivery/open/click webhook intake, one-click unsubscribe |
| `diamond-ai-broadcast`, `diamond-generate-sequence`, `diamond-sequence-runner`, `diamond-crm-email`, `diamond-compose-email`, `diamond-broadcast-email`, `diamond-follow-up` | AI-assisted email marketing (OpenRouter-generated copy, tiered broadcasts, triggered flows) — optional, needs the schema noted in §5 |
| `diamond-ig-bot` | Instagram DM ordering bot — optional, has its own `README.md` alongside it |

## 8. Implemented features

**Storefront** — home page (hero carousel, featured products, categories, testimonials, CTAs,
announcement bar, free-delivery progress bar), shop page with search + category filtering,
product detail with size/variant picker and stock display, cart (localStorage, coupon/voucher
support, delivery-fee calculation), Paystack inline checkout (card/transfer/USSD), order success
page, order tracking by order number or email, bundle/offer landing pages with their own cart
flow, a referral page ("give cake, get cake"), Meta Pixel + server-side CAPI tracking, first-party
analytics event logging.

**Auth** — sign up, sign in, password reset, profile editing, guest-checkout-to-account claiming.

**Admin dashboard** — products, categories, orders (with status updates), coupons, delivery
areas, hero banners, site settings, and a CRM tab (customer pipeline board, searchable customer
list with per-customer detail + one-off email send, live email-performance dashboard reading from
the Resend-backed edge functions).

**Full list of gaps found and closed in this pass** is in §5 and §9 below.

## 9. Known gaps / unfinished features

1. **CRM/referral/analytics database objects were missing** — the app code called tables/RPCs
   that didn't exist. **Fixed in this pass** — see `schema-crm-extensions.sql` (§5).
2. **`.env.example` didn't exist** despite being referenced by the setup docs. **Fixed** — added.
3. **Two orphaned admin components** — `CampaignsEditor.tsx` and `MarketingComposer.tsx` were
   dead code (not imported anywhere); `app/admin/crm/page.tsx` even has a comment saying "the old
   manual Marketing/Campaigns editors are gone." **Removed** in this pass.
4. **AI email marketing + Instagram bot** — UI and edge functions exist, database objects don't
   (see §5). Intentionally left as a follow-up: it needs an `OPENROUTER_API_KEY`, and the exact
   shape of a dozen tables is a product decision (email tone/cadence, tier definitions, bot
   conversation state machine) rather than something to infer from the client code alone.
5. **`todo.md` is stale** — it's an early scaffolding checklist that mostly predates the current,
   largely-complete implementation; most unchecked items (home page sections, cart, checkout,
   auth pages, admin sections) are actually built. Treat this README, not `todo.md`, as the
   current source of truth for what's implemented.
6. **No automated tests** for the actual app — `vitest.config.ts` and the one existing test file
   both belong to the unused `server/`/`client/` scaffold (§4), not to `app/`/`lib`/`components/`.
7. **Legacy scaffold directories** (`client/`, `server/`, `shared/`, `drizzle/`, and their config
   files) are inert but still present — see §4.
8. **Contact page** shows "Contact details coming soon" only when `diamond_site_settings` has no
   phone/email/WhatsApp/Instagram/pickup address filled in — this is a graceful empty state, not
   a bug; fill those fields in `/admin/settings`.
9. **`npm run build` failed out of the box — fixed.** `tsconfig.json` type-checked the whole repo
   including the dead `client/` scaffold, which imports packages that were never installed
   (`drizzle-kit`, `wouter`, shadcn `sonner`/`tooltip`). Excluded the scaffold dirs/configs from
   both `tsconfig.json` and `eslint.config.mjs`; verified with a clean production build afterward.
10. **~170 `no-explicit-any` / lint errors — mostly cleared.** Added `Order`, `Coupon`, `Customer`,
    `DeliveryFee`, and `HeroImage` to `lib/types.ts` and typed the admin dashboard, cart, and order
    components against them instead of `any` (plus a shared `errorMessage()` helper in
    `lib/format.ts` to replace the `catch (err: any) { alert(err.message) }` pattern). Verified
    with `npm run build` after every batch — it caught two real nullability gaps this surfaced
    (`Coupon.min_order_amount` and `Order.customer_phone` being optional) which are now handled
    correctly instead of silently assumed non-null.
    Left alone: ~26 `react-hooks/set-state-in-effect` warnings (a React Compiler-oriented rule
    flagging the very common "fetch in `useEffect`, `setState` in the callback" pattern across
    checkout, cart, auth, and admin) and ~39 `@next/next/no-img-element` warnings (suggesting
    `next/image`). Neither blocks `npm run build`, neither is a functional bug, and "fixing" the
    first properly means restructuring data-loading in high-traffic flows (cart, checkout, login)
    without a live database to verify against — not a safe trade to make blind.

## 10. Setup

```bash
npm install
cp .env.example .env.local      # fill in your Supabase + Paystack keys
# In Supabase SQL Editor, run schema.sql, then schema-crm-extensions.sql
npm run dev                     # http://localhost:3000
```

Full walkthrough (Supabase project, storage buckets, Paystack, admin account, deploy): see
[SETUP-GUIDE.md](./SETUP-GUIDE.md).
