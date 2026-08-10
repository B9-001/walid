"use client";

import { formatNaira } from "@/lib/format";
import { OFFER_FREE_DELIVERY_MIN } from "@/lib/offer";

// "Add ₦X more to get FREE delivery" — shown on both carts.
export default function FreeDeliveryBar({ subtotal }: { subtotal: number }) {
  const gap = Math.max(0, OFFER_FREE_DELIVERY_MIN - subtotal);
  const unlocked = subtotal >= OFFER_FREE_DELIVERY_MIN;
  const pct = Math.min(100, Math.round((subtotal / OFFER_FREE_DELIVERY_MIN) * 100));

  return (
    <div className={`rounded-2xl p-4 sm:p-5 border ${unlocked ? "bg-brand-primary/5 border-brand-primary/30" : "bg-brand-light border-brand-primary/25"}`}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="text-xl">🚚</span>
        <p className="font-sans text-sm text-brand-dark">
          {unlocked ? (
            <><span className="font-bold text-brand-primary">You&apos;ve unlocked FREE delivery!</span> 🎉</>
          ) : (
            <>Add <span className="font-bold text-brand-primary">{formatNaira(gap)}</span> more to get <span className="font-bold">FREE delivery</span></>
          )}
        </p>
      </div>
      <div className="h-2.5 bg-brand-paper rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand-primary to-brand-plum rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="font-sans text-[11px] text-brand-grey mt-2">A small service fee applies to some far-out areas.</p>
    </div>
  );
}
