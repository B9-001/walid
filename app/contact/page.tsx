"use client";

import { useEffect, useState } from "react";
import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import Footer from "@/components/diamond/Footer";
import { supabase } from "@/lib/supabase";
import type { SiteSettings } from "@/lib/types";

export default function ContactPage() {
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
  const rows = [
    s.contact_phone && { label: "Phone", value: s.contact_phone, href: `tel:${s.contact_phone}` },
    s.contact_email && { label: "Email", value: s.contact_email, href: `mailto:${s.contact_email}` },
    s.whatsapp_number && {
      label: "WhatsApp",
      value: s.whatsapp_number,
      href: `https://wa.me/${s.whatsapp_number.replace(/[^0-9]/g, "")}`,
    },
    igHandle && { label: "Instagram", value: `@${igHandle}`, href: `https://instagram.com/${igHandle}` },
    s.pickup_address && { label: "Pickup", value: s.pickup_address, href: null },
  ].filter(Boolean) as { label: string; value: string; href: string | null }[];

  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <div className="max-w-[800px] mx-auto px-6 md:px-10 py-20 md:py-28 text-center">
          <span className="font-sans text-[10px] label-track text-brand-primary">We&apos;d love to hear from you</span>
          <h1 className="font-display text-5xl md:text-7xl text-brand-dark mt-3">
            Get in <span className="font-script text-brand-primary font-normal">touch</span>
          </h1>
          <p className="font-sans text-sm md:text-base text-brand-dark/70 mt-5 max-w-md mx-auto">
            Questions about a custom order or a big batch of puff puff &amp; pancakes? Reach out, we&apos;re happy to help.
          </p>

          <div className="mt-12 grid gap-3 text-left">
            {rows.length === 0 ? (
              <p className="text-center text-brand-grey font-sans text-sm">Contact details coming soon.</p>
            ) : (
              rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-brand-light border border-brand-line px-6 py-5"
                >
                  <span className="font-sans text-[10px] label-track text-brand-primary shrink-0">{r.label}</span>
                  {r.href ? (
                    <a href={r.href} target="_blank" rel="noreferrer" className="font-sans text-sm md:text-base text-brand-dark hover:text-brand-primary transition-colors text-right min-w-0 break-words">
                      {r.value}
                    </a>
                  ) : (
                    <span className="font-sans text-sm md:text-base text-brand-dark text-right min-w-0 break-words">{r.value}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
