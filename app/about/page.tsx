import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import About from "@/components/diamond/About";
import FinalCTA from "@/components/diamond/FinalCTA";
import Footer from "@/components/diamond/Footer";

export const metadata = { title: "About | Diamond Taste" };

export default function AboutPage() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1 pt-10">
        <div className="max-w-[1300px] mx-auto px-6 md:px-10 pt-10 pb-4 text-center">
          <span className="font-sans text-[10px] label-track text-brand-primary">Diamond Taste</span>
          <h1 className="font-display text-5xl md:text-7xl text-brand-dark mt-3">
            About <span className="font-script text-brand-primary font-normal">us</span>
          </h1>
        </div>
        <About />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
