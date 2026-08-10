import { redirect } from "next/navigation";

// The offer funnel now shares the normal cart (vouchers + free delivery together).
export default function Offer1CartPage() {
  redirect("/cart");
}
