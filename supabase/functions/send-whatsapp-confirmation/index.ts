// Supabase Edge Function — Deno runtime
// Called by the Next.js API route immediately after a booking is created.
// Sends the booking confirmation WhatsApp template.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ConfirmationPayload {
  appointmentId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: ConfirmationPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { appointmentId } = body;
  if (!appointmentId) {
    return new Response(JSON.stringify({ error: "appointmentId required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Fetch appointment with related data
  const { data: appt, error } = await supabase
    .from("appointments")
    .select(`
      id, appointment_time, total_price,
      customer:profiles!appointments_customer_id_fkey (full_name, phone_whatsapp, whatsapp_opt_in),
      barber:profiles!appointments_barber_id_fkey (full_name),
      service:services (name),
      appointment_addons (
        service:services (name, price)
      )
    `)
    .eq("id", appointmentId)
    .single();

  if (error || !appt) {
    return new Response(JSON.stringify({ error: "Appointment not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const customer = Array.isArray(appt.customer) ? appt.customer[0] : appt.customer;
  const service  = Array.isArray(appt.service)  ? appt.service[0]  : appt.service;

  if (!customer.whatsapp_opt_in) {
    return new Response(JSON.stringify({ skipped: true, reason: "opt_out" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const apptDate = new Date(appt.appointment_time);
  const provider = (Deno.env.get("WHATSAPP_PROVIDER") ?? "twilio") as "twilio" | "meta";

  const variables = {
    "1": customer.full_name,
    "2": service.name,
    "3": apptDate.toLocaleDateString("en-ZA", {
      weekday: "long",
      year:    "numeric",
      month:   "long",
      day:     "numeric",
      timeZone: "Africa/Johannesburg",
    }),
    "4": apptDate.toLocaleTimeString("en-ZA", {
      hour:   "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Africa/Johannesburg",
    }),
  };

  const templateId =
    provider === "twilio"
      ? Deno.env.get("TWILIO_TEMPLATE_SID_CONFIRMATION")!
      : "booking_confirmation";

  let result: { success: boolean; messageId?: string; error?: string };

  if (provider === "twilio") {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const authToken  = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM")!;

    const formBody = new URLSearchParams({
      From:             `whatsapp:${fromNumber}`,
      To:               `whatsapp:${customer.phone_whatsapp}`,
      ContentSid:       templateId,
      ContentVariables: JSON.stringify(variables),
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody.toString(),
      }
    );
    const data = await res.json();
    result = res.ok
      ? { success: true, messageId: data.sid }
      : { success: false, error: data.message };
  } else {
    const phoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID")!;
    const accessToken   = Deno.env.get("META_ACCESS_TOKEN")!;

    const payload = {
      messaging_product: "whatsapp",
      to: customer.phone_whatsapp.replace("+", ""),
      type: "template",
      template: {
        name: templateId,
        language: { code: "en" },
        components: [{
          type: "body",
          parameters: Object.values(variables).map((v) => ({ type: "text", text: v })),
        }],
      },
    };

    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    result = res.ok
      ? { success: true, messageId: data.messages?.[0]?.id }
      : { success: false, error: data.error?.message };
  }

  // Log result
  await supabase.from("whatsapp_message_log").insert({
    recipient_phone:    customer.phone_whatsapp,
    template_name:      "booking_confirmation",
    template_variables: variables,
    provider,
    provider_message_id: result.messageId,
    status:             result.success ? "sent" : "failed",
    error_message:      result.error,
    appointment_id:     appointmentId,
    sent_at:            result.success ? new Date().toISOString() : null,
  });

  if (result.success) {
    await supabase
      .from("appointments")
      .update({ confirmation_sent: true })
      .eq("id", appointmentId);
  }

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});
