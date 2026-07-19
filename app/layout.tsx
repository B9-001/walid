import type { Metadata } from "next";
import { Poppins, Fraunces } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { AuthProvider } from "@/lib/auth";
import LoginPrompt from "@/components/diamond/LoginPrompt";
import ProfileModal from "@/components/diamond/ProfileModal";
import MetaPixel from "@/components/diamond/MetaPixel";
import Analytics from "@/components/diamond/Analytics";
import SourceCapture from "@/components/diamond/SourceCapture";
import { Suspense } from "react";

const poppins = Poppins({
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  subsets: ["latin"],
});

// Warm, old-style editorial serif: soft optical sizing + italics for accent words.
// Variable font: weight range is implicit, so we declare axes instead of a weight list.
const fraunces = Fraunces({
  style: ["normal", "italic"],
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

// Resolves automatically on Vercel; override with NEXT_PUBLIC_SITE_URL if needed.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  "http://localhost:3000";

const title = "Diamond Taste | Cakes, Cupcakes & Sweet Treats";
const description =
  "Diamond Taste: handcrafted milk cakes, birthday cakes, cupcakes and pastries. Order your custom cake online.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: {
    icon: "/favicon.ico",
  },
  // og:image / twitter:image are added automatically from app/opengraph-image.tsx
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Diamond Taste",
    type: "website",
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${fraunces.variable} scroll-smooth`}
    >
      <body className="min-h-screen bg-brand-paper text-brand-dark font-sans antialiased selection:bg-brand-primary selection:text-brand-light overflow-x-hidden flex flex-col">
        <MetaPixel />
        <SourceCapture />
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
        <AuthProvider>
          <CartProvider>
            {children}
            <LoginPrompt />
            <ProfileModal />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
