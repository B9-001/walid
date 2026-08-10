"use client";

const features = [
  {
    title: "Made with love",
    body: "Crafted with quality ingredients for a rich, indulgent taste every time.",
    icon: <path d="M12 20l-7-7a4 4 0 015.7-5.7L12 8l1.3-0.7A4 4 0 0119 13l-7 7z" />,
  },
  {
    title: "Careful delivery",
    body: "Boxed and handled with care so it arrives looking perfect.",
    icon: (
      <path d="M3 7l9-4 9 4v10l-9 4-9-4V7zm9-4v18M3 7l9 4 9-4" />
    ),
  },
];

export default function FeatureStrip() {
  return (
    <section className="bg-brand-paper">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-brand-line border-y border-brand-line">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-4 py-8 md:px-8 first:md:pl-0">
              <span className="feature-icon shrink-0">
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {f.icon}
                </svg>
              </span>
              <div>
                <h3 className="font-display text-lg text-brand-dark">{f.title}</h3>
                <p className="text-sm text-brand-dark/60 mt-1 leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
