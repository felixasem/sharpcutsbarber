import Link from "next/link";
import { Scissors, Clock, Phone, LayoutDashboard, LogOut, UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// Dynamic — needs auth cookie on every request
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch role if logged in
  let role: string | null = null;
  let fullName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    role     = profile?.role ?? null;
    fullName = profile?.full_name ?? null;
  }

  const isStaff    = role === "admin" || role === "barber";
  const isCustomer = role === "customer";

  return (
    <main className="min-h-screen bg-zinc-900 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 text-xl font-extrabold">
          <Scissors className="h-6 w-6 text-amber-400" />
          SharpCuts
        </div>

        <div className="flex items-center gap-3">
          {/* Logged-in state */}
          {user ? (
            <>
              <span className="hidden sm:flex items-center gap-2 text-sm text-zinc-400">
                <UserCircle className="h-4 w-4" />
                {fullName ?? user.email}
              </span>

              {isStaff ? (
                /* Staff → Go to Dashboard */
                <Link
                  href="/admin"
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-amber-400 transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              ) : (
                /* Customer → Book Now */
                <Link
                  href="/booking"
                  className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-amber-400 transition-colors"
                >
                  Book Now
                </Link>
              )}

              {/* Sign out */}
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </form>
            </>
          ) : (
            /* Logged out → Book Now only; Staff Login in hero */
            <Link
              href="/booking"
              className="rounded-xl bg-amber-500 px-5 py-2.5 font-semibold text-zinc-900 hover:bg-amber-400 transition-colors"
            >
              Book Now
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 text-sm text-amber-400 font-medium mb-8">
          <Phone className="h-4 w-4" /> WhatsApp confirmations & reminders
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-tight">
          Look sharp.
          <br />
          <span className="text-amber-400">Stay sharp.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-400 max-w-xl mx-auto">
          Premium cuts, fade specialists &amp; beard artists. Book in 60 seconds,
          get instant WhatsApp confirmation.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {isStaff ? (
            /* Staff: prominent dashboard CTA */
            <Link
              href="/admin"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-8 py-4 text-lg font-bold text-zinc-900 hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
            >
              <LayoutDashboard className="h-5 w-5" />
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/booking"
                className="w-full sm:w-auto rounded-2xl bg-amber-500 px-8 py-4 text-lg font-bold text-zinc-900 hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
              >
                Book Your Appointment
              </Link>

              {/* Only show Staff Login when NOT logged in */}
              {!user && (
                <Link
                  href="/login?next=/admin"
                  className="w-full sm:w-auto rounded-2xl border border-zinc-700 px-8 py-4 text-lg font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  Staff Login
                </Link>
              )}
            </>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20 grid sm:grid-cols-3 gap-6">
        {[
          {
            icon: <Scissors className="h-6 w-6 text-amber-400" />,
            title: "Premium Services",
            desc: "Classic cuts, skin fades, beard trims & luxury add-ons.",
          },
          {
            icon: <Clock className="h-6 w-6 text-amber-400" />,
            title: "Real-time Booking",
            desc: "See live availability & pick your slot instantly.",
          },
          {
            icon: <Phone className="h-6 w-6 text-amber-400" />,
            title: "WhatsApp Updates",
            desc: "Booking confirmation, 24h & 2h reminders direct to your phone.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-zinc-800 bg-zinc-800/50 p-6"
          >
            <div className="mb-4">{f.icon}</div>
            <h3 className="font-bold text-white mb-1">{f.title}</h3>
            <p className="text-sm text-zinc-400">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
