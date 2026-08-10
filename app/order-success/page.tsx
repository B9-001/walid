import { Suspense } from "react";
import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import Footer from "@/components/diamond/Footer";
import OrderSuccess from "@/components/diamond/OrderSuccess";

export const metadata = { title: "Order Confirmed | thepufflette.co" };

export default function OrderSuccessPage() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="flex justify-center py-40">
              <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <OrderSuccess />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
