import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import Hero from "@/components/diamond/Hero";
import DuoBoxSection from "@/components/diamond/DuoBoxSection";
import FeatureStrip from "@/components/diamond/FeatureStrip";
import FeaturedProducts from "@/components/diamond/FeaturedProducts";
import BundleSection from "@/components/diamond/BundleSection";
import CategoryShowcase from "@/components/diamond/CategoryShowcase";
import Testimonial from "@/components/diamond/Testimonial";
import About from "@/components/diamond/About";
import FinalCTA from "@/components/diamond/FinalCTA";
import Footer from "@/components/diamond/Footer";

export default function Home() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <DuoBoxSection />
        <FeaturedProducts />
        <BundleSection />
        <FeatureStrip />
        <CategoryShowcase />
        <Testimonial />
        <About />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
