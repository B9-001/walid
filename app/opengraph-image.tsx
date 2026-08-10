import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const alt = "Diamond Taste: Cakes, Cupcakes & Sweet Treats";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded share card: hero photo + logo + wordmark. Generated at build time.
export default async function Image() {
  const [logo, hero] = await Promise.all([
    readFile(join(process.cwd(), "public/logo.jpg")),
    readFile(join(process.cwd(), "public/heroes/hero-cheesecake-lifestyle.jpg")),
  ]);
  const logoSrc = `data:image/jpeg;base64,${logo.toString("base64")}`;
  const heroSrc = `data:image/jpeg;base64,${hero.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroSrc} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} alt="" />
        <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, background: "linear-gradient(180deg, rgba(43,23,34,0.50), rgba(43,23,34,0.85))" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 30 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={156} height={156} style={{ borderRadius: 78, border: "5px solid rgba(255,255,255,0.9)" }} alt="" />
          <div style={{ display: "flex", alignItems: "center", fontSize: 88, fontWeight: 700, letterSpacing: -1 }}>
            <span style={{ color: "#FFFFFF" }}>Diamond</span>
            <span style={{ color: "#EC008C", marginLeft: 20 }}>Taste</span>
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "rgba(255,255,255,0.88)", letterSpacing: 4, textTransform: "uppercase" }}>
            Cakes · Cupcakes · Sweet Treats
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
