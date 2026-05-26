import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPromotionalOffer } from "@/lib/whatsapp/client";

// POST /api/promotions/blast — send a WhatsApp marketing blast to opted-in customers
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins may blast
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { promotionId: string; targetUserIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { promotionId, targetUserIds } = body;

  const { data: promo } = await supabase
    .from("promotions")
    .select("*")
    .eq("id", promotionId)
    .eq("active", true)
    .single();

  if (!promo) {
    return NextResponse.json(
      { error: "Promotion not found or inactive" },
      { status: 404 }
    );
  }

  let query = supabase
    .from("profiles")
    .select("id, full_name, phone_whatsapp")
    .eq("role", "customer")
    .eq("whatsapp_opt_in", true)
    .neq("phone_whatsapp", "");

  if (targetUserIds?.length) {
    query = query.in("id", targetUserIds);
  }

  const { data: customers, error: custErr } = await query;
  if (custErr) {
    return NextResponse.json({ error: custErr.message }, { status: 500 });
  }

  const results = { sent: 0, failed: 0, total: customers?.length ?? 0 };

  const BATCH_SIZE  = 10;
  const BATCH_DELAY = 500; // ms

  for (let i = 0; i < (customers ?? []).length; i += BATCH_SIZE) {
    const batch = customers!.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (customer) => {
        const result = await sendPromotionalOffer(customer.phone_whatsapp, {
          customerName:    customer.full_name,
          discountPercent: String(Math.round(promo.discount_percent)),
          promoCode:       promo.code,
        });

        await supabase.from("whatsapp_message_log").insert({
          recipient_phone:     customer.phone_whatsapp,
          template_name:       "promotional_offer",
          template_variables:  { customerName: customer.full_name, promoCode: promo.code },
          provider:            result.provider,
          provider_message_id: result.messageId,
          status:              result.success ? "sent" : "failed",
          error_message:       result.error,
          sent_at:             result.success ? new Date().toISOString() : null,
        });

        if (result.success) results.sent++;
        else results.failed++;
      })
    );

    if (i + BATCH_SIZE < (customers ?? []).length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY));
    }
  }

  return NextResponse.json(results);
}
