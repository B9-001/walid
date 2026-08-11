"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { SiteSettings } from "@/lib/types";

export default function Footer() {
  const [s, setS] = useState<Partial<SiteSettings>>({});

  useEffect(() => {
    supabase
      .from("diamond_site_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setS(data);
      });
  }, []);

  const igHandle = s.instagram_handle?.replace(/^@/, "");

  return (
    <footer id="contact" className="mt-auto bg-brand-dark text-brand-light">
      <div className="container py-16 md:py-20">
        {/* Top: brand + social call-out (the inspo's "stay tuned" block) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-12 border-b border-brand-light/10">
          <div className="max-w-md">
            <span className="font-display text-3xl md:text-4xl">
              thepufflette<span className="italic text-brand-primary">.co</span>
            </span>
            <p className="text-sm text-brand-light/65 leading-relaxed mt-4">
              Gourmet puff puff and fluffy pancakes, freshly made to order
              and delivered to your door.
            </p>
          </div>
          {igHandle && (
            <a
              href={`https://instagram.com/${igHandle}`}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-3 text-sm tracking-[0.18em] uppercase font-semibold text-brand-light/80 hover:text-brand-primary transition-colors"
            >
              Follow @{igHandle}
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </a>
          )}
        </div>

        {/* Columns */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-10 pt-12">
          <div className="flex flex-col gap-4">
            <span className="text-[10px] tracking-[0.24em] uppercase text-brand-light/45 font-semibold">Shop</span>
            <div className="flex flex-col gap-3">
              <FooterLink href="/shop">All Treats</FooterLink>
              <FooterLink href="/shop?category=gourmet-pancakes">Gourmet Pancakes</FooterLink>
              <FooterLink href="/shop?category=gourmet-puff-puff">Gourmet Puff Puff</FooterLink>
              <FooterLink href="/cart">Your Cart</FooterLink>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <span className="text-[10px] tracking-[0.24em] uppercase text-brand-light/45 font-semibold">Explore</span>
            <div className="flex flex-col gap-3">
              <FooterLink href="/about">About Us</FooterLink>
              <FooterLink href="/contact">Contact</FooterLink>
            </div>
          </div>

          <div className="flex flex-col gap-4 col-span-2 md:col-span-1">
            <span className="text-[10px] tracking-[0.24em] uppercase text-brand-light/45 font-semibold">Get in touch</span>
            <div className="flex flex-col gap-3">
              {s.contact_phone && <FooterLink href={`tel:${s.contact_phone}`}>{s.contact_phone}</FooterLink>}
              {s.contact_email && <FooterLink href={`mailto:${s.contact_email}`}>{s.contact_email}</FooterLink>}
              {s.whatsapp_number && (
                <FooterLink href={`https://wa.me/${s.whatsapp_number.replace(/[^0-9]/g, "")}`} external>
                  WhatsApp
                </FooterLink>
              )}
              {igHandle && (
                <FooterLink href={`https://instagram.com/${igHandle}`} external>@{igHandle}</FooterLink>
              )}
            </div>
          </div>
        </div>

        <div className="pt-12 mt-12 border-t border-brand-light/10 text-[10px] tracking-[0.2em] uppercase text-brand-light/45">
          © {new Date().getFullYear()} thepufflette.co. Made fresh, made with love
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const cls =
    "group relative w-fit text-sm text-brand-light/80 hover:text-brand-primary transition-colors";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
