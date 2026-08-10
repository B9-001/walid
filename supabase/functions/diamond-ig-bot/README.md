# thepufflette.co — Instagram chatbot

Supabase Edge Function (Deno) that runs the thepufflette.co Instagram ordering bot —
the equivalent of the Shop Devouge bot, adapted for thepufflette.co's data model
(diamond_* tables, money in kobo, Abuja delivery areas, free delivery over ₦20k +
far-area service fee, DT-XXXXXX order IDs).

## What it does
Welcome → Shop (website or in-chat) → Categories → Products → Quantity → Cart →
Checkout (delivery area / pickup) → Order summary → Paystack payment page.
Plus: track order by ID, "my orders" (linked by Instagram sender), and human handoff.

Every choice is shown as a **button carousel** (cards with big tappable buttons, max
3 per card) rather than quick-reply chips — so options stay visible and customers
don't get lost. Copy uses plain, direct words ("order", "cart", "pay") throughout.

## Secrets
Start with the **test** Instagram credentials and **test** Paystack key:

Paystack secrets are namespaced `DT_` (the project is shared with other clients'
bots — EA_/EK_/MS_ etc.). The `DT_PAYSTACK_*` ones are already set.

```bash
supabase secrets set \
  TEST_TOKEN="<instagram page access token>" \
  TEST_ID="<instagram business account id>" \
  DT_PAYSTACK_SECRET="sk_test_..." \
  DT_PAYSTACK_SUBACCOUNT="ACCT_rkdr66y94q0xz5c"   # optional split \
  RESEND_API_KEY="<optional, for handoff emails>" \
  SHOP_SUPPORT_EMAIL="admin@example.com" \
  SHOP_FROM_EMAIL="onboarding@resend.dev"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## Deploy
```bash
supabase functions deploy diamond-ig-bot --no-verify-jwt
```

## Meta webhook
- Callback URL: the deployed function URL
- Verify token: `diamondtaste2026`
- Subscribe the IG account to `messages`, `messaging_postbacks`.

## Tables (created by the diamond_ig_bot_tables migration)
`diamond_bot_sessions`, `diamond_bot_messages`, `diamond_bot_payments`,
`diamond_bot_complaints`, and `diamond_orders.ig_sender_id`.

## Follow-up scheduler (`diamond-follow-up`)
A second function in `supabase/functions/diamond-follow-up`. It re-engages customers
who went quiet mid-flow: every 15 min it finds `diamond_bot_sessions` idle for 45+
minutes (in `awaiting_payment`, `review`, `shopping`, or `await_track_id`, not in
handoff) that haven't been nudged yet, and sends a contextual button carousel. The
main bot clears `last_followup_at` on every interaction, so one fresh nudge is sent
per quiet period.

- Uses the same `TEST_TOKEN` / `TEST_ID` secrets as the bot.
- Deploy: `supabase functions deploy diamond-follow-up --no-verify-jwt`
- Scheduled by pg_cron job `diamond-follow-up-15min` (migration `diamond_follow_up_cron`,
  which enables `pg_cron` + `pg_net` and POSTs to the function every 15 min).

## Order finalisation (`diamond-paystack-webhook`)
The bot only **creates the Paystack page** and records a row in `diamond_bot_payments`.
The `diamond-paystack-webhook` function turns a *paid* bot order into a real
`diamond_orders` row (DT-XXXXXX number, `ig_sender_id`, items, kobo totals), then:
decrements `stock_level`, emails the customer + thepufflette.co via
`diamond-send-order-email`, DMs the customer their order number, and clears/saves
their bot session.

- Deploy: `supabase functions deploy diamond-paystack-webhook --no-verify-jwt`
- Verifies `x-paystack-signature` (HMAC-SHA512) against `DT_PAYSTACK_SECRET`
  (and `DT_PAYSTACK_LIVE` if set), so it rejects forged calls (401).
- **One manual step:** in the Paystack dashboard → Settings → API Keys & Webhooks,
  set the webhook URL to this function and enable the `charge.success` event:
  `https://YOUR_SUPABASE_PROJECT_REF.supabase.co/functions/v1/diamond-paystack-webhook`
