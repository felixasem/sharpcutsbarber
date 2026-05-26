// Supabase Edge Function — Deno runtime
// Called by the admin API route to blast a promotion to all opted-in customers.
// Uses the approved "promotional_offer" WhatsApp marketing template.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface BlastPayload {
  promotionId: string;
  /** Optional: only send to specific user IDs (for A/B or targeted blasts) */
  targetUserIds?: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Only admins may call this — validate the Authorization header contains a
  // valid JWT whose profile has role=admin.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const callerToken = authHeader.split(" ")[1];

  // Verify caller is admin using their JWT (RLS-scoped client)
  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${callerToken}` } } }
  );

  const { data: callerProfile, error: profileErr } = await callerClient
    .from("profiles")
    .select("role")
    .single();

  if (profileErr || callerProfile?.role !== "admin") {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Use service role for the actual data reads/writes
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: BlastPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { promotionId, targetUserIds } = body;

  // Fetch the promotion
  const { data: promo, error: promoErr } = await supabase
    .from("promotions")
    .select("*")
    .eq("id", promotionId)
    .eq("active", true)
    .single();

  if (promoErr || !promo) {
    return new Response(
      JSON.stringify({ error: "Promotion not found or inactive" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // Fetch opted-in customers
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
    return new Response(JSON.stringify({ error: custErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!customers || customers.length === 0) {
    return new Response(
      JSON.stringify({ sent: 0, failed: 0, message: "No eligible customers" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const provider = (Deno.env.get("WHATSAPP_PROVIDER") ?? "twilio") as "twilio" | "meta";
  const templateId =
    provider === "twilio"
      ? Deno.env.get("TWILIO_TEMPLATE_SID_PROMOTION")!
      : "promotional_offer";

  const results = { sent: 0, failed: 0, total: customers.length };

  // Rate-limit: send in batches of 10 with a 500ms pause between batches
  // to stay within WhatsApp's per-second rate limit.
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 500;

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (customer) => {
        const variables: Record<string, string> = {
          "1": customer.full_name,
          "2": String(Math.round(promo.discount_percent)),
          "3": promo.code,
        };

        let waResult: { success: boolean; messageId?: string; error?: string };

        if (provider === "twilio") {
          const accountSid  = Deno.env.get("TWILIO_ACCOUNT_SID")!;
          const authToken   = Deno.env.get("TWILIO_AUTH_TOKEN")!;
          const fromNumber  = Deno.env.get("TWILIO_WHATSAPP_FROM")!;

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
          waResult = res.ok
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
                parameters: Object.values(variables).map((v) => ({
                  type: "text",
                  text: v,
                })),
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
          waResult = res.ok
            ? { success: true, messageId: data.messages?.[0]?.id }
            : { success: false, error: data.error?.message };
        }

        // Log each attempt
        await supabase.from("whatsapp_message_log").insert({
          recipient_phone:     customer.phone_whatsapp,
          template_name:       "promotional_offer",
          template_variables:  variables,
          provider,
          provider_message_id: waResult.messageId,
          status:              waResult.success ? "sent" : "failed",
          error_message:       waResult.error,
          sent_at:             waResult.success ? new Date().toISOString() : null,
        });

        if (waResult.success) results.sent++;
        else results.failed++;
      })
    );

    // Pause between batches (skip after last batch)
    if (i + BATCH_SIZE < customers.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  console.log(
    `[promo-blast] Promotion "${promo.code}" — sent: ${results.sent}/${results.total}, failed: ${results.failed}`
  );

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});
