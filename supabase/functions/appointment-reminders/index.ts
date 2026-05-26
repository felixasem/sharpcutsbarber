// Supabase Edge Function — Deno runtime
// Triggered hourly by pg_cron. Finds appointments in ~24h and ~2h,
// sends WhatsApp reminders via the approved template.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AppointmentRow {
  id: string;
  appointment_time: string;
  reminder_24h_sent: boolean;
  reminder_2h_sent: boolean;
  customer: {
    full_name: string;
    phone_whatsapp: string;
    whatsapp_opt_in: boolean;
  };
  barber: {
    full_name: string;
  };
  service: {
    name: string;
  };
}

interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ── WhatsApp sender (Twilio) ───────────────────────────────────────────────────
async function sendWhatsAppTemplate(
  to: string,
  templateSid: string,
  variables: Record<string, string>,
  provider: "twilio" | "meta" = "twilio"
): Promise<WhatsAppResult> {
  if (provider === "twilio") {
    return sendViaTwilio(to, templateSid, variables);
  }
  return sendViaMeta(to, templateSid, variables);
}

async function sendViaTwilio(
  to: string,
  templateSid: string,
  variables: Record<string, string>
): Promise<WhatsAppResult> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM")!; // e.g. whatsapp:+14155238886

  const body = new URLSearchParams({
    From: `whatsapp:${fromNumber}`,
    To: `whatsapp:${to}`,
    ContentSid: templateSid,
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
      body: body.toString(),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    return { success: false, error: data.message ?? "Twilio error" };
  }
  return { success: true, messageId: data.sid };
}

async function sendViaMeta(
  to: string,
  templateName: string,
  variables: Record<string, string>
): Promise<WhatsAppResult> {
  const phoneNumberId = Deno.env.get("META_PHONE_NUMBER_ID")!;
  const accessToken = Deno.env.get("META_ACCESS_TOKEN")!;

  // Build ordered components array from variables object
  const parameters = Object.values(variables).map((v) => ({
    type: "text",
    text: v,
  }));

  const payload = {
    messaging_product: "whatsapp",
    to: to.replace("+", ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: "en" },
      components: [{ type: "body", parameters }],
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

  if (!res.ok) {
    return { success: false, error: data.error?.message ?? "Meta API error" };
  }
  return { success: true, messageId: data.messages?.[0]?.id };
}

// ── Edge Function handler ──────────────────────────────────────────────────────
Deno.serve(async (_req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // service role bypasses RLS
    );

    const provider = (Deno.env.get("WHATSAPP_PROVIDER") ?? "twilio") as
      | "twilio"
      | "meta";

    const now = new Date();
    const results = { sent: 0, failed: 0, skipped: 0 };

    // ── 24-hour reminder window (23h45m → 24h15m from now) ──────────────────
    const window24hStart = new Date(now.getTime() + 23 * 60 * 60 * 1000 + 45 * 60 * 1000);
    const window24hEnd   = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 15 * 60 * 1000);

    const { data: appointments24h, error: err24 } = await supabase
      .from("appointments")
      .select(`
        id, appointment_time, reminder_24h_sent,
        customer:profiles!appointments_customer_id_fkey (full_name, phone_whatsapp, whatsapp_opt_in),
        barber:profiles!appointments_barber_id_fkey (full_name),
        service:services (name)
      `)
      .in("status", ["confirmed", "pending"])
      .eq("reminder_24h_sent", false)
      .gte("appointment_time", window24hStart.toISOString())
      .lte("appointment_time", window24hEnd.toISOString());

    if (err24) throw new Error(`24h query failed: ${err24.message}`);

    // ── 2-hour reminder window (1h45m → 2h15m from now) ────────────────────
    const window2hStart = new Date(now.getTime() + 1 * 60 * 60 * 1000 + 45 * 60 * 1000);
    const window2hEnd   = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 15 * 60 * 1000);

    const { data: appointments2h, error: err2 } = await supabase
      .from("appointments")
      .select(`
        id, appointment_time, reminder_2h_sent,
        customer:profiles!appointments_customer_id_fkey (full_name, phone_whatsapp, whatsapp_opt_in),
        barber:profiles!appointments_barber_id_fkey (full_name),
        service:services (name)
      `)
      .in("status", ["confirmed", "pending"])
      .eq("reminder_2h_sent", false)
      .gte("appointment_time", window2hStart.toISOString())
      .lte("appointment_time", window2hEnd.toISOString());

    if (err2) throw new Error(`2h query failed: ${err2.message}`);

    const REMINDER_TEMPLATE =
      provider === "twilio"
        ? Deno.env.get("TWILIO_TEMPLATE_SID_REMINDER")!
        : "appointment_reminder";

    // ── Process both windows ─────────────────────────────────────────────────
    const processAppointments = async (
      appointments: AppointmentRow[],
      reminderType: "24h" | "2h"
    ) => {
      for (const appt of appointments) {
        const customer = Array.isArray(appt.customer)
          ? appt.customer[0]
          : appt.customer;
        const barber  = Array.isArray(appt.barber)  ? appt.barber[0]  : appt.barber;

        if (!customer?.whatsapp_opt_in) {
          results.skipped++;
          continue;
        }

        const apptDate = new Date(appt.appointment_time);
        const timeStr  = apptDate.toLocaleTimeString("en-ZA", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Africa/Johannesburg",
        });

        const variables: Record<string, string> = {
          "1": customer.full_name,
          "2": barber.full_name,
          "3": reminderType === "24h"
            ? `${apptDate.toLocaleDateString("en-ZA", { weekday: "long", month: "long", day: "numeric" })} at ${timeStr}`
            : timeStr,
        };

        const waResult = await sendWhatsAppTemplate(
          customer.phone_whatsapp,
          REMINDER_TEMPLATE,
          variables,
          provider
        );

        // Log the message attempt
        await supabase.from("whatsapp_message_log").insert({
          recipient_phone: customer.phone_whatsapp,
          template_name: "appointment_reminder",
          template_variables: variables,
          provider,
          provider_message_id: waResult.messageId,
          status: waResult.success ? "sent" : "failed",
          error_message: waResult.error,
          appointment_id: appt.id,
          sent_at: waResult.success ? new Date().toISOString() : null,
        });

        if (waResult.success) {
          // Mark reminder as sent so we don't double-send
          const updateField =
            reminderType === "24h" ? "reminder_24h_sent" : "reminder_2h_sent";
          await supabase
            .from("appointments")
            .update({ [updateField]: true })
            .eq("id", appt.id);

          results.sent++;
        } else {
          results.failed++;
          console.error(
            `[reminders] Failed to send ${reminderType} reminder for ${appt.id}:`,
            waResult.error
          );
        }
      }
    };

    await processAppointments(
      (appointments24h ?? []) as unknown as AppointmentRow[],
      "24h"
    );
    await processAppointments(
      (appointments2h ?? []) as unknown as AppointmentRow[],
      "2h"
    );

    console.log(
      `[reminders] Run complete — sent: ${results.sent}, failed: ${results.failed}, skipped: ${results.skipped}`
    );

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[reminders] Fatal error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
