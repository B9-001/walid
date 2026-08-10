import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import Footer from "@/components/diamond/Footer";
import CartView from "@/components/diamond/CartView";

export const metadata = { title: "Cart | Diamond Taste" };

export default function CartPage() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <CartView />
      </main>
      <Footer />
    </>
  );
}
