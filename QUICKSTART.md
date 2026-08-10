# thepufflette.co - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Your environment variables are already configured. Verify they're set correctly:
- Supabase URL: `https://mlixtbyhsltflysatsib.supabase.co`
- Paystack keys: Configured (test mode)

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Access Admin Dashboard
1. Go to [http://localhost:3000/admin](http://localhost:3000/admin)
2. Sign up with your email
3. Contact the admin to add your user ID to the `diamond_admins` table

### 5. Add Your First Product
1. Go to Admin → Products
2. Click "Add Product"
3. Fill in product details (name, price, description, image)
4. Click Save

## 📁 Project Structure at a Glance

| Folder | Purpose |
|--------|---------|
| `app/` | Pages (home, shop, admin, checkout, etc.) |
| `components/diamond/` | Reusable UI components |
| `lib/` | Utility functions (Supabase, Paystack, formatting) |
| `public/` | Static assets (logo, images) |
| `supabase/` | Edge functions (optional) |

## 🔑 Key Files to Know

- **`app/page.tsx`** - Home page
- **`app/admin/page.tsx`** - Admin dashboard
- **`lib/supabase.ts`** - Supabase client
- **`components/diamond/Navbar.tsx`** - Navigation
- **`app/globals.css`** - Design tokens and styles

## 🎨 Customize Your Store

### Change Brand Colors
Edit `app/globals.css` and update the CSS variables:
```css
:root {
  --color-brand-primary: #your-color;
  --color-brand-secondary: #your-color;
}
```

### Change Logo
Replace `public/logo.jpg` with your logo

### Change Shop Name
Search for "Diamond Taste" in the codebase and replace with your brand name

## 💳 Payment Testing

**Test Card Details:**
- Card Number: `4084084084084081`
- Expiry: Any future date (e.g., 12/25)
- CVV: Any 3 digits (e.g., 123)

## 📦 Build for Production

```bash
npm run build
npm start
```

## 🔗 Important Links

- **Supabase Dashboard:** https://app.supabase.com
- **GitHub Repository:** https://github.com/B9-001/diamond-taste
- **Paystack Dashboard:** https://dashboard.paystack.com
- **Full Documentation:** See `PROJECT_SETUP.md`

## ❓ Common Tasks

### Add a Product Category
1. Admin → Categories
2. Click "Add Category"
3. Enter name and description
4. Save

### Create a Coupon
1. Admin → Coupons
2. Click "Add Coupon"
3. Set code, discount type, and value
4. Save

### View Orders
1. Admin → Orders
2. See all customer orders
3. Update status as needed

### Configure Delivery Areas
1. Admin → Delivery
2. Add locations and fees
3. Save

## 🚨 Troubleshooting

**Dev server won't start?**
```bash
rm -rf node_modules
npm install
npm run dev
```

**Can't see products?**
- Check that you've added products in Admin → Products
- Verify Supabase connection is working

**Images not showing?**
- Upload images through Admin → Products
- Ensure Supabase storage buckets exist

## 📚 Next Steps

1. Customize colors and branding
2. Add your products
3. Set up delivery areas and fees
4. Configure Paystack with live keys
5. Deploy to production

---

**Need help?** Check `PROJECT_SETUP.md` for detailed documentation.
