# This is NOT the Next.js you know

This version (Next.js 16) has breaking changes — APIs, conventions, and file structure may differ from older Next.js. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Project conventions
- Money is stored and handled in **kobo** (₦ × 100) as integers everywhere. Format for display with `formatNaira()` in `lib/format.ts`.
- All database tables are prefixed `diamond_` and live in your Supabase project.
- The cart is client-side only (localStorage via the `CartProvider` context in `lib/cart.tsx`).
- Brand theme tokens (`brand-primary` magenta, `brand-plum`, `brand-cream`) live in `app/globals.css`.
