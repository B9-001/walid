"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { cartPath } from "@/lib/offer";
import type { User } from "@supabase/supabase-js";

const links = [
  { href: "/shop?pick=1", label: "Shop" },
  { href: "/shop?category=gourmet-pancakes", label: "Gourmet Pancakes" },
  { href: "/shop?category=gourmet-puff-puff", label: "Gourmet Puff Puff" },
  { href: "/about", label: "About" },
  { href: "/track", label: "Track Order" },
  { href: "/refer", label: "Refer & Earn" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartHref, setCartHref] = useState("/cart");
  const { count } = useCart();
  const { user, loading: authLoading, openLogin, openProfile, signOut } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keep the cart icon pointing at the offer cart while in the offer funnel
  useEffect(() => { setCartHref(cartPath()); }, []);

  // Lock body scroll while the mobile menu is open (same as the admin shell)
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
    <header
      className={`sticky top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || mobileOpen
          ? "bg-brand-paper/90 backdrop-blur-md border-b border-brand-line py-3 shadow-[0_10px_30px_-12px_rgba(28,22,19,0.18)]"
          : "bg-transparent py-5"
      }`}
    >
      <div className="container flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <div className="rounded-full overflow-hidden h-10 w-10 md:h-11 md:w-11 bg-brand-light border border-brand-line">
            <img src="/logo.jpg" alt="thepufflette.co" className="w-full h-full object-cover" />
          </div>
          <span className="font-display text-xl md:text-2xl text-brand-dark leading-none">
            thepufflette<span className="italic text-brand-primary">.co</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="group relative text-[11px] font-semibold tracking-[0.18em] uppercase text-brand-dark/70 hover:text-brand-primary transition-colors"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-primary group-hover:w-full transition-all duration-300" />
            </Link>
          ))}
          <CartButton count={count} href={cartHref} />
          {!authLoading && <UserButton user={user} openLogin={openLogin} openProfile={openProfile} />}
        </nav>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <CartButton count={count} href={cartHref} />
          {!authLoading && (
            user ? (
              <button
                onClick={openProfile}
                aria-label="account"
                className="w-9 h-9 rounded-full bg-brand-primary flex items-center justify-center shrink-0 overflow-hidden"
              >
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="font-sans text-[12px] font-bold text-white leading-none">
                    {(user.user_metadata?.full_name || user.user_metadata?.name || user.email || "?")[0].toUpperCase()}
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={() => openLogin()}
                aria-label="sign in"
                className="w-10 h-10 rounded-full border border-brand-line bg-brand-light flex items-center justify-center text-brand-plum hover:bg-brand-primary hover:text-brand-light transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            )
          )}
          <button
            aria-label="menu"
            onClick={() => setMobileOpen((o) => !o)}
            className="p-2 relative z-50"
          >
            <div className={`w-6 h-0.5 bg-brand-primary transition-all duration-300 ${mobileOpen ? "rotate-45 translate-y-1.5" : "mb-1.5"}`} />
            <div className={`w-6 h-0.5 bg-brand-primary transition-all duration-300 ${mobileOpen ? "opacity-0" : "mb-1.5"}`} />
            <div className={`w-6 h-0.5 bg-brand-primary transition-all duration-300 ${mobileOpen ? "-rotate-45 -translate-y-[11px]" : ""}`} />
          </button>
        </div>
      </div>

    </header>

    {/* Mobile menu — full-screen slide-in overlay with its own top bar, so it
        always clears the announcement bar + navbar regardless of their height. */}
    <div
      className={`md:hidden fixed inset-0 z-[60] bg-brand-paper flex flex-col transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}
    >
      <div className="flex items-center justify-between p-5 border-b border-brand-line shrink-0">
        <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
          <div className="rounded-full overflow-hidden h-9 w-9 bg-brand-light border border-brand-line">
            <img src="/logo.jpg" alt="thepufflette.co" className="w-full h-full object-cover" />
          </div>
          <span className="font-display text-xl text-brand-dark leading-none">
            thepufflette<span className="italic text-brand-primary">.co</span>
          </span>
        </Link>
        <button onClick={() => setMobileOpen(false)} aria-label="close menu" className="p-2 text-brand-primary">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex flex-col gap-1 p-6 overflow-y-auto flex-1">
        {links.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            onClick={() => setMobileOpen(false)}
            className="rounded-xl px-4 py-3.5 text-brand-dark/70 hover:bg-brand-blush/50 hover:text-brand-primary transition-colors"
          >
            <span className="font-sans text-sm font-semibold tracking-[0.14em] uppercase">{l.label}</span>
          </Link>
        ))}

        <div className="border-t border-brand-line mt-3 pt-5 px-4">
          {!authLoading && (
            user ? (
              <div className="space-y-3">
                <p className="font-sans text-[11px] text-brand-dark/50">
                  Signed in as <span className="font-semibold text-brand-dark">{user.user_metadata?.full_name || user.email}</span>
                </p>
                <button
                  onClick={() => { signOut(); setMobileOpen(false); }}
                  className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-dark/50 hover:text-brand-primary transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => { openLogin(); setMobileOpen(false); }}
                className="flex items-center gap-2 text-sm font-semibold tracking-[0.14em] uppercase text-brand-primary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Sign In / Register
              </button>
            )
          )}
        </div>
      </nav>
    </div>
    </>
  );
}

function UserButton({ user, openLogin, openProfile }: { user: User | null; openLogin: () => void; openProfile: () => void }) {
  if (!user) {
    return (
      <button
        onClick={() => openLogin()}
        className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.16em] uppercase text-brand-dark/50 hover:text-brand-primary transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Sign in
      </button>
    );
  }

  const initials = (user.user_metadata?.full_name || user.user_metadata?.name || user.email || "U")
    .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const avatar = user.user_metadata?.avatar_url;

  return (
    <button
      onClick={openProfile}
      aria-label="my details"
      className="w-9 h-9 rounded-full overflow-hidden border-2 border-brand-primary/30 hover:border-brand-primary transition-colors shrink-0"
    >
      {avatar ? (
        <img src={avatar} alt={initials} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="w-full h-full bg-brand-blush flex items-center justify-center font-sans text-[11px] font-bold text-brand-primary">{initials}</span>
      )}
    </button>
  );
}

function CartButton({ count, href = "/cart" }: { count: number; href?: string }) {
  return (
    <Link
      href={href}
      className="relative flex items-center justify-center w-10 h-10 rounded-full border border-brand-line bg-brand-light hover:bg-brand-primary hover:text-brand-light text-brand-plum transition-colors"
      aria-label="cart"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-brand-primary text-brand-light text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-brand-paper">
          {count}
        </span>
      )}
    </Link>
  );
}
