"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { freeDeliveryMin } from "@/lib/offer";

export default function AnnouncementBar() {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    supabase
      .from("diamond_site_settings")
      .select("announcement, free_delivery_threshold")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const custom = data?.announcement?.trim();
        if (custom) {
          setText(custom);
          return;
        }
        // No custom announcement set (or the settings row doesn't exist yet):
        // fall back to the free-delivery message rather than hiding the bar
        // entirely. Built from the threshold actually in force, so it can never
        // advertise a figure the checkout doesn't honour.
        const min = freeDeliveryMin(data?.free_delivery_threshold);
        setText(`Free delivery on orders over ${formatNaira(min)}`);
      });
  }, []);

  if (!text) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-brand-dark text-brand-light/90 text-center py-2.5 px-4"
    >
      <p className="font-sans text-[10px] md:text-[11px] tracking-[0.22em] uppercase font-medium flex items-center justify-center gap-2.5">
        <span className="w-1 h-1 rounded-full bg-brand-primary" />
        {text}
        <span className="w-1 h-1 rounded-full bg-brand-primary" />
      </p>
    </motion.div>
  );
}
