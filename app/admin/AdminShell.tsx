"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const links = [
  { name: "Overview", href: "/admin", sub: "at a glance" },
  { name: "CRM", href: "/admin/crm", sub: "customers & email" },
  { name: "Products", href: "/admin/products", sub: "menu items" },
  { name: "Categories", href: "/admin/categories", sub: "shop sections" },
  { name: "Orders", href: "/admin/orders", sub: "customer orders" },
  { name: "Coupons", href: "/admin/coupons", sub: "discount codes" },
  { name: "Delivery", href: "/admin/delivery", sub: "fees & areas" },
  { name: "Hero Slides", href: "/admin/hero", sub: "homepage banner" },
  { name: "Settings", href: "/admin/settings", sub: "shop details" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) {
      setAuthChecked(true);
      return;
    }
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/admin/login"); return; }
      // Only accounts on the admin allowlist may access the admin
      const { data: admin } = await supabase
        .from("diamond_admins")
        .select("id")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!admin) { await supabase.auth.signOut(); router.replace("/admin/login"); return; }
      setAuthChecked(true);
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session && !isLoginPage) router.replace("/admin/login");
      else if (session) setAuthChecked(true);
    });
    return () => subscription.unsubscribe();
  }, [isLoginPage, router]);

  // Lock body scroll when the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobileOpen]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  };

  if (isLoginPage) return <>{children}</>;
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-brand-paper flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const Wordmark = () => (
    <span className="font-display text-xl text-brand-dark leading-none">
      thepufflette<span className="italic text-brand-primary">.co</span>
    </span>
  );

  return (
    <div className="bg-brand-paper min-h-screen text-brand-dark flex relative">
      {/* Sidebar — mirrors the storefront navbar identity */}
      <aside className="w-64 bg-brand-light border-r border-brand-line hidden md:flex flex-col p-7 h-screen sticky top-0 shrink-0">
        <Link href="/admin" className="flex items-center gap-3 mb-11">
          <div className="rounded-full overflow-hidden h-10 w-10 bg-brand-light border border-brand-line shrink-0">
            <img src="/logo.jpg" alt="thepufflette.co" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <Wordmark />
            <span className="font-sans text-[9px] tracking-[0.32em] uppercase text-brand-dark/35 mt-1">Admin</span>
          </div>
        </Link>

        <nav className="flex flex-col gap-1.5 flex-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`group relative rounded-xl px-3.5 py-2.5 transition-all ${
                  active
                    ? "bg-brand-blush/60"
                    : "hover:bg-brand-paper"
                }`}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-brand-primary rounded-full" />}
                <span className={`font-sans text-[11px] font-semibold tracking-[0.16em] uppercase block transition-colors ${active ? "text-brand-primary" : "text-brand-dark/55 group-hover:text-brand-dark"}`}>
                  {l.name}
                </span>
                <span className="font-script text-[13px] text-brand-dark/35 block leading-tight mt-0.5">{l.sub}</span>
              </Link>
            );
          })}
        </nav>

        <div className="pt-6 mt-4 border-t border-brand-line flex flex-col gap-3">
          <Link href="/" className="group inline-flex items-center gap-2 text-brand-dark/40 hover:text-brand-primary transition-colors text-[10px] tracking-[0.18em] uppercase font-semibold">
            View Site <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
          <button onClick={handleSignOut} className="text-left text-brand-dark/25 hover:text-brand-primary transition-colors text-[9px] tracking-[0.2em] uppercase font-semibold">
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen w-full">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between p-5 bg-brand-light border-b border-brand-line sticky top-0 z-50">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="rounded-full overflow-hidden h-8 w-8 bg-brand-light border border-brand-line">
              <img src="/logo.jpg" alt="thepufflette.co" className="w-full h-full object-cover" />
            </div>
            <Wordmark />
          </Link>
          <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2 relative z-50" aria-label="menu">
            <div className={`w-6 h-0.5 bg-brand-primary transition-all duration-300 ${isMobileOpen ? "rotate-45 translate-y-1.5" : "mb-1.5"}`} />
            <div className={`w-6 h-0.5 bg-brand-primary transition-all duration-300 ${isMobileOpen ? "opacity-0" : "mb-1.5"}`} />
            <div className={`w-6 h-0.5 bg-brand-primary transition-all duration-300 ${isMobileOpen ? "-rotate-45 -translate-y-[11px]" : ""}`} />
          </button>
        </header>

        <div className={`md:hidden fixed inset-0 top-[65px] bg-brand-paper z-40 overflow-y-auto transition-transform duration-300 ${isMobileOpen ? "translate-x-0" : "translate-x-full"}`}>
          <nav className="flex flex-col gap-1 p-6">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setIsMobileOpen(false)}
                className={`rounded-xl px-4 py-3 ${pathname === l.href ? "bg-brand-blush/60 text-brand-primary" : "text-brand-dark/60"}`}
              >
                <span className="font-sans text-sm font-semibold tracking-[0.15em] uppercase block">{l.name}</span>
                <span className="font-script text-sm text-brand-dark/35">{l.sub}</span>
              </Link>
            ))}
            <Link href="/" className="px-4 pt-6 mt-3 border-t border-brand-line text-brand-dark/40 text-xs uppercase tracking-widest font-semibold">View Site →</Link>
            <button onClick={handleSignOut} className="text-left px-4 pt-4 text-brand-dark/25 text-[10px] tracking-widest uppercase font-semibold">Sign Out</button>
          </nav>
        </div>

        <main className="flex-1 overflow-x-hidden p-6 md:p-12">
          <div className="max-w-5xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
