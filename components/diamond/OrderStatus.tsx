"use client";

// Visual order journey, like the tracking timeline in delivery apps.
// diamond_orders.status: pending | confirmed | baking | ready | completed | cancelled

const FLOW = ["pending", "confirmed", "baking", "ready", "completed"] as const;

const LABELS: Record<string, { delivery: string; pickup: string; sub: string }> = {
  pending:   { delivery: "Order placed",     pickup: "Order placed",     sub: "We've received your order" },
  confirmed: { delivery: "Confirmed",        pickup: "Confirmed",        sub: "Your order is confirmed" },
  baking:    { delivery: "Baking",           pickup: "Baking",           sub: "Freshly preparing your treats" },
  ready:     { delivery: "Out for delivery", pickup: "Ready for pickup", sub: "Almost there" },
  completed: { delivery: "Delivered",        pickup: "Picked up",        sub: "Enjoy! 🎂" },
};

export default function OrderStatus({
  status,
  method = "delivery",
}: {
  status: string;
  method?: string;
}) {
  if (status === "cancelled") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div>
          <p className="font-sans text-sm font-bold text-red-600">Order cancelled</p>
          <p className="font-sans text-[12px] text-red-500/80 mt-0.5">Please contact us if you think this is a mistake.</p>
        </div>
      </div>
    );
  }

  const current = Math.max(0, FLOW.indexOf(status as (typeof FLOW)[number]));
  const isPickup = method === "pickup";

  return (
    <div className="relative">
      {FLOW.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const label = LABELS[step][isPickup ? "pickup" : "delivery"];
        const isLast = i === FLOW.length - 1;

        return (
          <div key={step} className="flex gap-4 relative">
            {/* connector line */}
            {!isLast && (
              <span
                className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${i < current ? "bg-brand-primary" : "bg-brand-line"}`}
              />
            )}
            {/* node */}
            <div
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                done
                  ? "bg-brand-primary text-brand-light"
                  : active
                  ? "bg-brand-primary text-brand-light ring-4 ring-brand-primary/20"
                  : "bg-brand-light border-2 border-brand-line text-brand-dark/30"
              }`}
            >
              {done ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : active ? (
                <span className="w-2.5 h-2.5 rounded-full bg-brand-light animate-pulse" />
              ) : (
                <span className="font-sans text-[11px] font-bold">{i + 1}</span>
              )}
            </div>
            {/* text */}
            <div className={`pb-7 ${isLast ? "pb-0" : ""}`}>
              <p className={`font-sans text-sm font-semibold ${done || active ? "text-brand-dark" : "text-brand-dark/35"}`}>
                {label}
              </p>
              {active && (
                <p className="font-sans text-[12px] text-brand-primary mt-0.5">{LABELS[step].sub}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
