# Build Your Own Online Store — Step-by-Step Guide

This is a complete, production-ready **Next.js e-commerce storefront + admin dashboard**
(originally built for a bakery called "Diamond Taste"). It's yours to rebrand and launch
for any product-based business — cakes, food, fashion, gifts, anything.

Everything here runs on free / pay-as-you-go tiers. You do **not** need to write code to
launch it — just follow the steps, plug in your own accounts, and add your products from
the admin panel.

---

## What you get

- 🛍️ **Storefront** — home page, shop with search + categories, product pages, cart, checkout, order tracking.
- 🔐 **Admin dashboard** (`/admin`) — manage products, categories, orders, coupons, delivery areas, hero banners, and shop settings.
- 💳 **Paystack checkout** — take real payments (card, transfer, USSD).
- 📦 **Orders** — saved to your database, with status updates and (optionally) automatic confirmation emails.
- 📱 Fully responsive, fast, and SEO-friendly.

### The tech stack

| Piece | What it does | Cost |
|---|---|---|
| **Next.js 16** (React) | The website itself | Free (open source) |
| **Supabase** | Database, login/auth, image storage | Free tier |
| **Paystack** | Payments | Pay per transaction |
| **Vercel** | Hosting / deployment | Free tier |
| **Resend** *(optional)* | Order emails | Free tier |

---

## Prerequisites

1. **Node.js 20+** — install from [nodejs.org](https://nodejs.org).
2. A **[Supabase](https://supabase.com)** account (free).
3. A **[Paystack](https://paystack.com)** account (for payments).
4. A **[Vercel](https://vercel.com)** account (for going live) — optional until you deploy.
5. A code editor like [VS Code](https://code.visualstudio.com) — optional, only if you want to tweak things.

---

## Quick start (get it running locally in ~15 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Create your env file from the template
cp .env.example .env.local
#    → then open .env.local and fill in your Supabase + Paystack keys (see Step 2 & 4 below)

# 3. Run the dev server
npm run dev
```

Open <http://localhost:3000>. The storefront will load (empty until you add products in the admin).

---

## Detailed setup

### Step 1 — Install

```bash
npm install
```

### Step 2 — Set up Supabase (your database + storage)

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick a name and a strong database password. Wait ~2 minutes for it to provision.
2. In the left sidebar go to **SQL Editor** → **New query**. Open the `schema.sql` file in this
   project, paste its entire contents in, and click **Run**. This creates all the tables your
   store needs (products, orders, coupons, etc.) with the right permissions. Then do the same
   with `schema-crm-extensions.sql` — it adds the customer pipeline, referral program, and
   `/control` analytics dashboard objects that `schema.sql` alone doesn't include (see
   `README.md` §5 for what and why).
3. Go to **Project Settings → API** and copy these two values — you'll need them in Step 3:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key
   - **service_role** key (keep this one secret — server only)

### Step 3 — Create your storage buckets (for product & banner images)

1. In Supabase go to **Storage** → **New bucket**.
2. Create a bucket named exactly **`diamond-products`** and tick **Public bucket**.
3. Create a second bucket named exactly **`diamond-hero`**, also **Public**.
4. (If image uploads from the admin get blocked) go to **Storage → Policies** and add, for each
   bucket, a policy allowing `INSERT`, `UPDATE`, `DELETE`, and `SELECT` for the `public` role.
   The simplest is a policy with the definition `bucket_id = 'diamond-products'` (and one for
   `diamond-hero`).

> Prefer different bucket names? You can — just rename them in the code too
> (search the project for `diamond-products` / `diamond-hero`).

### Step 4 — Fill in your environment variables

Open **`.env.local`** (you created it with `cp .env.example .env.local`) and set at minimum:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxx      # from your Paystack dashboard
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Get your Paystack keys from [dashboard.paystack.com](https://dashboard.paystack.com) →
**Settings → API Keys & Webhooks**. Use the **test** keys while developing; switch to **live**
keys when you're ready to take real money.

> `.env.local` is git-ignored and never leaves your machine. The `.env.example` file is just a
> template of which variables exist — see it for the full (optional) list.

### Step 5 — Point Next.js at your Supabase images

Open **`next.config.ts`** and replace `YOUR_SUPABASE_PROJECT_REF` with your real project ref
so the app is allowed to display images from your Supabase storage:

```ts
{ protocol: "https", hostname: "YOUR-PROJECT-REF.supabase.co" }
```

### Step 6 — Create your admin account

The admin panel (`/admin`) is locked to an allowlist so random customers can't get in.

1. Start the app (`npm run dev`) and open <http://localhost:3000/admin>. Sign up with your email + password.
2. In Supabase → **Authentication → Users**, copy your new user's **UID**.
3. In Supabase → **SQL Editor**, run (replace the two values):
   ```sql
   insert into diamond_admins (id, email)
   values ('PASTE-YOUR-USER-UID', 'you@email.com');
   ```
4. Refresh `/admin` — you now have access.

### Step 7 — Add your shop content

Inside `/admin`, work through the sections:
- **Settings** — shop name details, contact info, free-delivery threshold, announcement bar.
- **Categories** — the sections customers browse (e.g. "Cakes", "Drinks").
- **Products** — add items, prices, photos, mark best-sellers as "Featured".
- **Delivery** — your delivery areas and their fees.
- **Hero Slides** — the big banners on the home page.
- **Coupons** — discount codes.

That's it — your store is live locally. 🎉

---

## Make it yours (branding)

| What | Where |
|---|---|
| **Colours** | `app/globals.css` — edit the `--color-brand-*` variables at the top. |
| **Fonts** | `app/layout.tsx` — swap the Google fonts. |
| **Logo** | Replace `public/logo.jpg` (and `public/favicon.ico`). |
| **Shop name / copy** | Search the project for "Diamond Taste" and replace it. Home-page sections live in `components/diamond/`. |
| **Currency** | Prices are stored in **kobo** (₦ × 100). The formatter is `lib/format.ts`. |

> Want to rename the `diamond_` table prefix or the `components/diamond/` folder to your own
> brand? You can — just do a find-and-replace across the whole project so the code and the
> database names stay in sync.

---

## Going live (deploy to Vercel)

1. Push this folder to your **own** new GitHub repo (`git init`, commit, push).
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import that repo.
3. In the project's **Settings → Environment Variables**, add every variable from your
   `.env.local` (at least the Supabase + Paystack + `NEXT_PUBLIC_SITE_URL` ones). Set
   `NEXT_PUBLIC_SITE_URL` to your real domain.
4. Click **Deploy**. Vercel builds and hosts it, and auto-redeploys every time you push to GitHub.
5. Add your custom domain under **Settings → Domains**.

---

## Optional extras

These are **not required** for a working store — enable them when you want.

- **Order confirmation & status emails** — powered by [Resend](https://resend.com). The email
  logic lives in `supabase/functions/` (the `*-send-order-email` and `*-order-status-email`
  functions). Deploy them with the Supabase CLI and set the `DT_RESEND_API_KEY` /
  `DT_FROM_EMAIL` secrets (see `.env.example`). Verify your sending domain in Resend first.
- **Facebook / Meta Pixel + Conversions API** — set `NEXT_PUBLIC_FB_PIXEL_ID` and `FB_CAPI_TOKEN`.
- **AI email marketing + Instagram bot** — advanced. The `supabase/functions/*-ai-*`,
  `*-broadcast-*`, `*-sequence-*` and `*-ig-bot` functions use OpenRouter (`OPENROUTER_API_KEY`).
  They need extra database tables not included in `schema.sql` — treat these as a bonus, not a
  starting point.
- **Payment webhook** — `supabase/functions/*-paystack-webhook` gives you a server-side backstop
  so orders are never lost even if the customer closes the tab. Optional but recommended for
  production.

---

## Project structure

```
app/                     Next.js routes (pages)
  page.tsx               Home page
  shop/ product/ cart/   Storefront pages
  checkout/ track/       Checkout + order tracking
  admin/                 The admin dashboard (protected)
  api/                   Server routes (analytics, Meta CAPI)
components/diamond/       All the UI building blocks (Navbar, Hero, ProductCard, ...)
  admin/                 Admin-only components
lib/                     Logic: supabase client, cart, coupons, paystack, formatting...
supabase/functions/       Optional edge functions (emails, AI, webhooks)
public/                   Static assets (logo, favicon, images)
app/globals.css           Design tokens (brand colours) + shared styles
schema.sql                ← run this in Supabase to create your database
.env.example              ← copy to .env.local and fill in your keys
next.config.ts            Next.js config (image hostname lives here)
```

## How it works (the short version)

- The **storefront** reads products/categories/settings from Supabase using the public **anon
  key** (safe to expose — the database's Row-Level Security controls what's allowed).
- The **cart** lives in the browser (localStorage) — no account needed to shop.
- At **checkout**, the customer pays via Paystack; on success the order is written to
  `diamond_orders`. Optionally an edge function emails them a confirmation.
- The **admin** signs in with Supabase Auth; only user IDs listed in `diamond_admins` can enter.
  All the "manage" screens read/write the same `diamond_*` tables.

---

## Troubleshooting

- **Store is empty** → you haven't added products yet (admin → Products), or `schema.sql` didn't run.
- **Images don't upload / show** → check your storage buckets exist, are **public**, have the
  upload policies (Step 3), and that `next.config.ts` has your project ref (Step 5).
- **Can't get into `/admin`** → make sure your user's UID is in `diamond_admins` (Step 6).
- **Payment popup errors** → check your Paystack public key is set and matches test/live mode.
- **Build fails on Vercel** → make sure all required environment variables are added in the
  Vercel project settings.

---

Happy building! Everything here is yours to change. Start by adding a few products and watch
your store come to life.
