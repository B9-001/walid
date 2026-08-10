import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import Footer from "@/components/diamond/Footer";
import CheckoutView from "@/components/diamond/CheckoutView";

export const metadata = { title: "Checkout | Diamond Taste" };

export default function CheckoutPage() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <CheckoutView />
      </main>
      <Footer />
    </>
  );
}
