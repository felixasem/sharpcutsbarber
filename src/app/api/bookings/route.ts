import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendBookingConfirmation } from "@/lib/whatsapp/client";
import { addMinutes, parseISO } from "date-fns";

// POST /api/bookings — create a new appointment
export async function POST(req: NextRequest) {
  // Accept auth from Bearer token (client fetch) OR cookie (SSR fallback)
  const sc = createServiceClient();
  let user: { id: string } | null = null;

  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data } = await sc.auth.getUser(authHeader.slice(7));
    user = data.user;
  }
  if (!user) {
    const cookieClient = await createClient();
    const { data } = await cookieClient.auth.getUser();
    user = data.user;
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    barberId: string;
    serviceId: string;
    addonIds?: string[];
    appointmentTime: string;
    promoCode?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { barberId, serviceId, addonIds = [], appointmentTime, promoCode, notes } = body;

  if (!barberId || !serviceId || !appointmentTime) {
    return NextResponse.json(
      { error: "barberId, serviceId, and appointmentTime are required" },
      { status: 400 }
    );
  }

  // Fetch the core service
  const { data: service } = await sc
    .from("services")
    .select("id, price, duration_minutes, name")
    .eq("id", serviceId)
    .eq("is_active", true)
    .single();

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  // Fetch add-ons
  const { data: addons = [] } = addonIds.length
    ? await sc
        .from("services")
        .select("id, price, duration_minutes")
        .in("id", addonIds)
        .eq("is_addon", true)
        .eq("is_active", true)
    : { data: [] };

  const addonPrice    = (addons ?? []).reduce((sum, a) => sum + a.price, 0);
  const addonDuration = (addons ?? []).reduce((sum, a) => sum + a.duration_minutes, 0);
  const totalDuration = service.duration_minutes + addonDuration;

  const apptStart = parseISO(appointmentTime);
  const apptEnd   = addMinutes(apptStart, totalDuration);

  // Check for overlapping appointments
  const { data: conflicts } = await sc
    .from("appointments")
    .select("id")
    .eq("barber_id", barberId)
    .not("status", "in", '("cancelled","no_show")')
    .lt("appointment_time", apptEnd.toISOString())
    .gt("end_time", apptStart.toISOString());

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: "This time slot is no longer available. Please choose another." },
      { status: 409 }
    );
  }

  // Resolve promo code
  let promotionId: string | null = null;
  let discountAmount = 0;

  if (promoCode) {
    const { data: promo } = await sc
      .from("promotions")
      .select("id, discount_percent, max_uses, current_uses, valid_until")
      .eq("code", promoCode.toUpperCase())
      .eq("active", true)
      .single();

    if (promo) {
      const expired   = promo.valid_until && new Date(promo.valid_until) < new Date();
      const exhausted = promo.max_uses !== null && promo.current_uses >= promo.max_uses;
      if (!expired && !exhausted) {
        promotionId    = promo.id;
        discountAmount = ((service.price + addonPrice) * promo.discount_percent) / 100;
      }
    }
  }

  const totalPrice = Math.max(0, service.price + addonPrice - discountAmount);

  // Insert appointment
  const { data: appointment, error: insertErr } = await sc
    .from("appointments")
    .insert({
      customer_id:      user.id,
      barber_id:        barberId,
      service_id:       serviceId,
      appointment_time: apptStart.toISOString(),
      end_time:         apptEnd.toISOString(),
      status:           "confirmed",
      notes:            notes ?? null,
      total_price:      totalPrice,
      promotion_id:     promotionId,
      discount_amount:  discountAmount,
    })
    .select()
    .single();

  if (insertErr || !appointment) {
    console.error("[bookings] insert error:", insertErr);
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }

  // Insert add-ons
  if (addons && addons.length > 0) {
    await sc.from("appointment_addons").insert(
      addons.map((a) => ({
        appointment_id: appointment.id,
        service_id:     a.id,
        price:          a.price,
      }))
    );
  }

  if (promotionId) {
    await sc.rpc("increment_promo_uses", { promo_id: promotionId });
  }

  // Send WhatsApp confirmation (non-blocking)
  const { data: customer } = await sc
    .from("profiles")
    .select("full_name, phone_whatsapp, whatsapp_opt_in")
    .eq("id", user.id)
    .single();

  if (customer?.whatsapp_opt_in && customer.phone_whatsapp) {
    sendBookingConfirmation(customer.phone_whatsapp, {
      customerName: customer.full_name,
      serviceName:  service.name,
      date: apptStart.toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Johannesburg" }),
      time: apptStart.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" }),
    }).then(async (result) => {
      await sc.from("whatsapp_message_log").insert({
        recipient_phone: customer.phone_whatsapp, template_name: "booking_confirmation",
        provider: result.provider, provider_message_id: result.messageId,
        status: result.success ? "sent" : "failed", error_message: result.error,
        appointment_id: appointment.id, sent_at: result.success ? new Date().toISOString() : null,
      });
      if (result.success) {
        await sc.from("appointments").update({ confirmation_sent: true }).eq("id", appointment.id);
      }
    }).catch((err) => console.error("[bookings] WhatsApp error:", err));
  }

  return NextResponse.json({ appointment }, { status: 201 });
}

// GET /api/bookings?barberId=&date=YYYY-MM-DD — taken slots for a barber
export async function GET(req: NextRequest) {
  const sc = createServiceClient(); // public read — no auth required for slot checking
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");
  const dateStr  = searchParams.get("date");

  if (!barberId || !dateStr) {
    return NextResponse.json({ error: "barberId and date are required" }, { status: 400 });
  }

  // Parse date as local midnight to match what the client sends
  const [y, m, d] = dateStr.split("-").map(Number);
  const dayStart  = new Date(y, m - 1, d, 0, 0, 0);
  const dayEnd    = new Date(y, m - 1, d, 23, 59, 59);

  const { data: takenSlots } = await sc
    .from("appointments")
    .select("appointment_time, end_time")
    .eq("barber_id", barberId)
    .not("status", "in", '("cancelled","no_show")')
    .gte("appointment_time", dayStart.toISOString())
    .lte("appointment_time", dayEnd.toISOString());

  return NextResponse.json({ takenSlots: takenSlots ?? [] });
}
