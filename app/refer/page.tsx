import AnnouncementBar from "@/components/diamond/AnnouncementBar";
import Navbar from "@/components/diamond/Navbar";
import Footer from "@/components/diamond/Footer";
import ReferProgram from "@/components/diamond/ReferProgram";

export const metadata = { title: "Refer & Earn | Diamond Taste" };

export default function ReferPage() {
  return (
    <>
      <AnnouncementBar />
      <Navbar />
      <main className="flex-1">
        <ReferProgram />
      </main>
      <Footer />
    </>
  );
}
