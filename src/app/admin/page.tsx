import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PromotionManager } from "@/components/admin/PromotionManager";
import { AppointmentCalendar } from "@/components/admin/AppointmentCalendar";

export const metadata = { title: "Admin Dashboard — SharpCuts" };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "barber"].includes(profile.role)) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
              Admin Dashboard
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Welcome back, {profile.full_name}
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 capitalize">
            {profile.role}
          </span>
        </div>

        {/* Today's schedule */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">
            Today&apos;s Appointments
          </h2>
          <AppointmentCalendar />
        </section>

        {/* Promotions — admins only */}
        {profile.role === "admin" && (
          <section>
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">
              Promotions & WhatsApp Blasts
            </h2>
            <PromotionManager />
          </section>
        )}
      </div>
    </main>
  );
}
