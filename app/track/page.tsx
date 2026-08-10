import { Suspense } from "react";
import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import Footer from "@/components/diamond/Footer";
import TrackOrder from "@/components/diamond/TrackOrder";

export const metadata = { title: "Track Order | Diamond Taste" };

export default function TrackPage() {
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
          <TrackOrder />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
