import { Suspense } from "react";
import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import Footer from "@/components/diamond/Footer";
import ShopBrowser from "@/components/diamond/ShopBrowser";

export const metadata = { title: "Shop | Diamond Taste" };

export default function ShopPage() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="flex justify-center py-32">
              <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <ShopBrowser />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
