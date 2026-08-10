# thepufflette.co E-Commerce Storefront - Project TODO

> **Stale.** This checklist predates most of the current implementation — nearly everything below
> marked unchecked (home page sections, cart, checkout, auth, admin sections) is actually built.
> See `README.md` §9 ("Known gaps / unfinished features") for the current, code-verified list of
> what's actually missing.

## Core Infrastructure
- [x] Supabase project setup and schema.sql execution
- [ ] Storage buckets creation (diamond-products, diamond-hero)
- [x] Environment variables configuration
- [x] GitHub repository creation and sync setup
- [ ] Paystack integration setup (placeholder keys configured)

## Database & Backend
- [x] Create Supabase tables via schema.sql
- [x] Set up RLS policies for public access
- [ ] Create storage bucket policies
- [x] Implement Supabase client in lib/supabase.ts
- [ ] Create database query helpers in server/db.ts
- [ ] Set up tRPC procedures for products, orders, coupons, etc.

## Storefront Pages
- [ ] Home page with hero carousel
- [ ] Featured products section on home
- [ ] Categories section on home
- [ ] Announcement bar component
- [ ] Free delivery bar component
- [ ] Testimonials section on home
- [ ] CTA sections on home
- [ ] Shop page with product grid
- [ ] Search functionality on shop page
- [ ] Category filtering on shop page
- [ ] Product detail page with images
- [ ] Size/variant picker on product detail
- [ ] Add-to-cart functionality
- [ ] Cart page with item management
- [ ] Coupon/voucher support on cart
- [ ] Order summary on cart
- [ ] Checkout page layout
- [ ] Paystack inline payment integration
- [ ] Payment method selection (card, transfer, USSD)
- [ ] Order success page
- [ ] Order tracking page
- [ ] Order lookup by order number
- [ ] Order lookup by email

## Authentication
- [ ] Sign up page
- [ ] Login page
- [ ] Password reset page
- [ ] Profile modal component
- [ ] Supabase auth integration
- [ ] Protected routes for authenticated users

## Admin Dashboard
- [ ] Admin route protection (/admin)
- [ ] Admin allowlist table (diamond_admins)
- [ ] Admin authentication check
- [ ] Admin dashboard layout
- [ ] Products management section
- [ ] Categories management section
- [ ] Orders management section
- [ ] Coupons management section
- [ ] Delivery areas management section
- [ ] Hero banners management section
- [ ] Site settings management section

## Styling & Design
- [ ] Define color palette and design tokens
- [ ] Set up Tailwind CSS configuration
- [ ] Create reusable component library
- [ ] Implement responsive design
- [ ] Mobile-first approach
- [ ] Brand consistency across pages

## Testing
- [ ] Unit tests for database queries
- [ ] Integration tests for tRPC procedures
- [ ] E2E tests for critical flows
- [ ] Payment flow testing with Paystack test mode

## Deployment & Integration
- [ ] GitHub repository setup
- [ ] Automatic GitHub sync on code changes
- [ ] Environment variables for production
- [ ] Vercel deployment configuration (optional)
- [ ] Final testing on production-like environment

## Completed Features
(Items will be moved here as they are completed)
