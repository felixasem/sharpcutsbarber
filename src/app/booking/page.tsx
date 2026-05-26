import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingForm } from "@/components/booking/BookingForm";

export const metadata = { title: "Book an Appointment — SharpCuts" };

export default async function BookingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Ensure the user has a WhatsApp number before they can book
  if (!user) {
    redirect("/login?next=/booking");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone_whatsapp, full_name")
    .eq("id", user.id)
    .single();

  if (!profile?.phone_whatsapp) {
    redirect("/account?setup=true&next=/booking");
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-xl px-4 py-8">
        <BookingForm />
      </div>
    </main>
  );
}
