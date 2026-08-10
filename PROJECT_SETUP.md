# Diamond Taste E-Commerce Storefront - Project Setup & Deployment Guide

## Project Overview

Diamond Taste is a complete, production-ready **Next.js e-commerce storefront + admin dashboard** built with Supabase for the database and Paystack for payments. The project includes a fully functional storefront with product browsing, shopping cart, checkout, order tracking, and a protected admin panel for managing products, orders, coupons, and more.

## Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 16 + React 19 | Storefront UI and admin dashboard |
| **Styling** | Tailwind CSS 4 | Modern, responsive design |
| **Database** | Supabase (PostgreSQL) | All data storage with Row-Level Security |
| **Authentication** | Supabase Auth | User registration, login, and admin access control |
| **Storage** | Supabase Storage | Product images and hero banners |
| **Payments** | Paystack | Payment processing (card, transfer, USSD) |
| **Animations** | Framer Motion | Smooth UI transitions |
| **Image Compression** | browser-image-compression | Client-side image optimization |

## Project Structure

```
diamond-taste/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                 # Home page
│   ├── shop/                    # Shop page with products
│   ├── product/                 # Product detail pages
│   ├── cart/                    # Shopping cart
│   ├── checkout/                # Checkout page
│   ├── order-success/           # Order confirmation
│   ├── track/                   # Order tracking
│   ├── auth/                    # Authentication pages (signup, login, reset)
│   ├── admin/                   # Admin dashboard (protected)
│   ├── api/                     # API routes
│   ├── layout.tsx               # Root layout
│   └── globals.css              # Global styles and design tokens
├── components/diamond/           # Reusable UI components
│   ├── Hero.tsx                 # Hero carousel
│   ├── Navbar.tsx               # Navigation bar
│   ├── ProductCard.tsx          # Product card component
│   ├── CartView.tsx             # Shopping cart view
│   ├── CheckoutView.tsx         # Checkout form
│   ├── ProfileModal.tsx         # User profile modal
│   ├── admin/                   # Admin-specific components
│   │   ├── ProductsEditor.tsx
│   │   ├── OrdersManager.tsx
│   │   ├── CouponsManager.tsx
│   │   └── SettingsManager.tsx
│   └── ...                      # Other components
├── lib/                         # Utility functions and helpers
│   ├── supabase.ts              # Supabase client initialization
│   ├── paystack.ts              # Paystack payment integration
│   ├── cart.ts                  # Cart logic
│   ├── coupon.ts                # Coupon validation
│   ├── product.ts               # Product queries
│   ├── format.ts                # Formatting utilities (prices, dates)
│   └── ...                      # Other utilities
├── public/                      # Static assets
│   ├── logo.jpg                 # Brand logo
│   ├── favicon.ico              # Favicon
│   ├── heroes/                  # Hero banner images
│   ├── bundles/                 # Bundle product images
│   └── icons/                   # App icons
├── supabase/functions/          # Supabase Edge Functions (optional)
│   ├── diamond-send-order-email/
│   ├── diamond-paystack-webhook/
│   └── ...                      # Other edge functions
├── schema.sql                   # Database schema
├── next.config.ts               # Next.js configuration
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript configuration
└── README.md                    # Project documentation
```

## Database Schema

All database tables follow the `diamond_*` naming convention:

- **diamond_categories** - Product categories (Cakes, Drinks, etc.)
- **diamond_products** - Product catalog with pricing and inventory
- **diamond_orders** - Customer orders with status tracking
- **diamond_coupons** - Discount codes and promotional coupons
- **diamond_hero_images** - Hero carousel banners
- **diamond_site_settings** - Global site configuration
- **diamond_delivery_fees** - Delivery area pricing
- **diamond_customers** - Customer profiles and leads
- **diamond_admins** - Admin user allowlist
- **diamond_analytics_events** - Lightweight analytics
- **diamond_email_log** - Email delivery tracking

## Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://mlixtbyhsltflysatsib.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Paystack Configuration
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_your_key_or_pk_live_your_key

# Site Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Important:** The `.env.local` file is git-ignored and never committed. Each environment (local, staging, production) needs its own configuration.

## Getting Started

### Prerequisites

- Node.js 20+ (download from [nodejs.org](https://nodejs.org))
- A Supabase account (free at [supabase.com](https://supabase.com))
- A Paystack account for payments (free at [paystack.com](https://paystack.com))

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env.local
   # Then fill in your Supabase and Paystack keys
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Database Setup

The database schema has already been created in your Supabase project. To verify:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. You should see all the `diamond_*` tables listed

### Storage Buckets

You need to create two public storage buckets in Supabase:

1. **diamond-products** - For product images
2. **diamond-hero** - For hero carousel banners

To create them:

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name it `diamond-products` and check "Public bucket"
4. Repeat for `diamond-hero`
5. Add upload policies if needed (see SETUP-GUIDE.md)

### Admin Access

To access the admin dashboard at `/admin`:

1. Sign up with your email at `/auth/signup`
2. Go to your Supabase dashboard → Authentication → Users
3. Copy your user's UID
4. Run this SQL in the SQL Editor:
   ```sql
   insert into diamond_admins (id, email)
   values ('YOUR-USER-UID', 'your@email.com');
   ```
5. Refresh `/admin` - you now have access

## Key Features

### Storefront

- **Home Page** - Hero carousel, featured products, categories, testimonials, CTAs
- **Shop Page** - Product browsing with search and category filtering
- **Product Detail** - Full product information, size/variant selection, image gallery
- **Shopping Cart** - Add/remove items, quantity adjustment, coupon application
- **Checkout** - Paystack inline payment integration (card, transfer, USSD)
- **Order Tracking** - Look up orders by order number or email
- **Authentication** - Sign up, login, password reset, profile management

### Admin Dashboard

- **Products** - Add, edit, delete products with images and pricing
- **Categories** - Manage product categories
- **Orders** - View and update order status
- **Coupons** - Create and manage discount codes
- **Delivery** - Configure delivery areas and fees
- **Hero Banners** - Manage home page carousel images
- **Settings** - Configure site name, contact info, delivery thresholds

## Money Format

All prices are stored in **kobo** (₦ × 100) as integers:

- ₦100 = 10,000 kobo
- ₦1,000 = 100,000 kobo
- ₦10,000 = 1,000,000 kobo

The `lib/format.ts` file handles conversion to naira for display.

## Paystack Integration

### Test Mode

Use Paystack test keys during development:

- **Test Card:** 4084084084084081
- **Expiry:** Any future date
- **CVV:** Any 3 digits

### Live Mode

When ready to accept real payments:

1. Get your live Paystack keys from [dashboard.paystack.com](https://dashboard.paystack.com)
2. Update `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` in your environment
3. Set up the payment webhook (optional but recommended)

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Add New" → "Project"
4. Import your GitHub repository
5. Add environment variables in Project Settings
6. Click "Deploy"

### Custom Hosting

The project can be deployed to any Node.js hosting:

```bash
npm run build
npm run start
```

## GitHub Integration

The project is connected to GitHub at: **https://github.com/B9-001/diamond-taste**

To sync changes:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

## Troubleshooting

### Store is empty
- Check that you've added products in the admin panel
- Verify the `schema.sql` was executed in Supabase

### Images don't upload/show
- Ensure storage buckets exist and are public
- Check that `next.config.ts` has your Supabase project ref
- Verify upload policies are configured

### Can't access admin panel
- Make sure your user UID is in the `diamond_admins` table
- Try clearing browser cache and logging out/in again

### Payment errors
- Verify your Paystack public key is correct
- Check that you're using test keys for development
- Ensure Paystack is configured for your country

## Optional Features

These advanced features are available but not required:

- **Email Notifications** - Order confirmation emails via Resend
- **Meta Pixel** - Facebook/Meta conversion tracking
- **AI Marketing** - Automated email sequences and Instagram bot
- **Payment Webhook** - Server-side order confirmation backup

See `supabase/functions/` for implementation details.

## Support & Resources

- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Paystack Docs:** https://paystack.com/docs
- **Tailwind CSS:** https://tailwindcss.com/docs

## License

This project is open source and ready to customize for your business.

---

**Happy building! Your Diamond Taste storefront is ready to go live.** 🎉
