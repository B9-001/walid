"use client";

// Rotating circular "stamp" badge — text runs along a circle with a small
// mark in the middle. Used as an editorial accent in the hero and CTA.
export default function Stamp({
  text = "DIAMOND TASTE · BAKED FRESH · MADE WITH LOVE · ",
  className = "",
  size = 116,
  tone = "plum",
}: {
  text?: string;
  className?: string;
  size?: number;
  tone?: "plum" | "light";
}) {
  const id = `stamp-${text.length}-${size}`;
  const color = tone === "light" ? "rgba(255,255,255,0.85)" : "currentColor";

  return (
    <div
      className={`stamp ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <path
            id={id}
            d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"
          />
        </defs>
        <text
          fontSize="8.5"
          letterSpacing="1.4"
          fill={color}
          style={{ textTransform: "uppercase", fontWeight: 600 }}
        >
          <textPath href={`#${id}`} startOffset="0">
            {text}
          </textPath>
        </text>
        {/* center mark */}
        <circle cx="50" cy="50" r="4.5" fill="none" stroke={color} strokeWidth="1" />
        <circle cx="50" cy="50" r="1.6" fill={color} />
      </svg>
    </div>
  );
}
