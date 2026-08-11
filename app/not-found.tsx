import Link from "next/link";
import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import Footer from "@/components/diamond/Footer";

export const metadata = { title: "Page not found | thepufflette.co" };

export default function NotFound() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <div className="max-w-[800px] mx-auto px-6 md:px-10 py-24 md:py-32 text-center">
          <span className="font-sans text-[10px] label-track text-brand-primary">Error 404</span>
          <h1 className="font-display text-5xl md:text-7xl text-brand-dark mt-3">
            Page not <span className="font-script text-brand-primary font-normal">found</span>
          </h1>
          <p className="font-sans text-sm md:text-base text-brand-dark/70 mt-5 max-w-md mx-auto">
            We couldn&apos;t find that page, but there are plenty of treats to discover.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/" className="btn-brand">
              Back to home
            </Link>
            <Link href="/shop" className="btn-ghost">
              Browse the menu
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
