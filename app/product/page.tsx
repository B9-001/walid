import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import Footer from "@/components/diamond/Footer";
import ProductDetail from "@/components/diamond/ProductDetail";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}): Promise<Metadata> {
  const { id } = await searchParams;
  const fallbackDescription =
    "Handcrafted cakes baked fresh and made to celebrate. Order online from Diamond Taste.";

  if (!id) {
    return { title: "Our Cakes | Diamond Taste", description: fallbackDescription };
  }

  const { data } = await supabase
    .from("diamond_products")
    .select("name, description, image_url")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();

  if (!data) {
    return { title: "Our Cakes | Diamond Taste", description: fallbackDescription };
  }

  const product = data as { name: string; description: string | null; image_url: string | null };
  const trimmed = (product.description || "").trim();
  const description =
    trimmed.length > 155 ? `${trimmed.slice(0, 152).trimEnd()}...` : trimmed || fallbackDescription;

  return {
    title: `${product.name} | Diamond Taste`,
    description,
    openGraph: product.image_url ? { images: [product.image_url] } : undefined,
  };
}

export default async function ProductPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <ProductDetail id={id ?? ""} />
      </main>
      <Footer />
    </>
  );
}
