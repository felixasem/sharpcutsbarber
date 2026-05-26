// WhatsApp provider abstraction — Twilio or Meta Cloud API.
// All functions are NO-OPS when credentials are not configured.
// Set TWILIO_ACCOUNT_SID (or META_ACCESS_TOKEN) in .env.local to activate.

export type WhatsAppProvider = "twilio" | "meta";

export interface SendResult {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  provider: WhatsAppProvider;
  error?: string;
}

function isConfigured(): boolean {
  const provider = process.env.WHATSAPP_PROVIDER ?? "twilio";
  if (provider === "twilio") {
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
    );
  }
  return !!(process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID);
}

function getProvider(): WhatsAppProvider {
  return (process.env.WHATSAPP_PROVIDER ?? "twilio") as WhatsAppProvider;
}

// ── Twilio ─────────────────────────────────────────────────────────────────────
async function sendViaTwilio(
  to: string,
  templateSid: string,
  variables: Record<string, string>
): Promise<SendResult> {
  if (!templateSid) {
    return { success: false, provider: "twilio", skipped: true };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken  = process.env.TWILIO_AUTH_TOKEN!;
  const from       = process.env.TWILIO_WHATSAPP_FROM!;

  const body = new URLSearchParams({
    From:             `whatsapp:${from}`,
    To:               `whatsapp:${to}`,
    ContentSid:       templateSid,
    ContentVariables: JSON.stringify(variables),
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );

  const data = await res.json();
  return res.ok
    ? { success: true, provider: "twilio", messageId: data.sid }
    : { success: false, provider: "twilio", error: data.message };
}

// ── Meta ───────────────────────────────────────────────────────────────────────
async function sendViaMeta(
  to: string,
  templateName: string,
  variables: Record<string, string>
): Promise<SendResult> {
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID!;
  const accessToken   = process.env.META_ACCESS_TOKEN!;

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components: [{
            type: "body",
            parameters: Object.values(variables).map((text) => ({ type: "text", text })),
          }],
        },
      }),
    }
  );

  const data = await res.json();
  return res.ok
    ? { success: true, provider: "meta", messageId: data.messages?.[0]?.id }
    : { success: false, provider: "meta", error: data.error?.message };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function sendBookingConfirmation(
  to: string,
  vars: { customerName: string; serviceName: string; date: string; time: string }
): Promise<SendResult> {
  if (!isConfigured()) return { success: true, skipped: true, provider: getProvider() };

  const indexed = { "1": vars.customerName, "2": vars.serviceName, "3": vars.date, "4": vars.time };
  const provider = getProvider();

  return provider === "twilio"
    ? sendViaTwilio(to, process.env.TWILIO_TEMPLATE_SID_CONFIRMATION!, indexed)
    : sendViaMeta(to, "booking_confirmation", indexed);
}

export async function sendAppointmentReminder(
  to: string,
  vars: { customerName: string; barberName: string; timeDescription: string }
): Promise<SendResult> {
  if (!isConfigured()) return { success: true, skipped: true, provider: getProvider() };

  const indexed = { "1": vars.customerName, "2": vars.barberName, "3": vars.timeDescription };
  const provider = getProvider();

  return provider === "twilio"
    ? sendViaTwilio(to, process.env.TWILIO_TEMPLATE_SID_REMINDER!, indexed)
    : sendViaMeta(to, "appointment_reminder", indexed);
}

export async function sendPromotionalOffer(
  to: string,
  vars: { customerName: string; discountPercent: string; promoCode: string }
): Promise<SendResult> {
  if (!isConfigured()) return { success: true, skipped: true, provider: getProvider() };

  const indexed = { "1": vars.customerName, "2": vars.discountPercent, "3": vars.promoCode };
  const provider = getProvider();

  return provider === "twilio"
    ? sendViaTwilio(to, process.env.TWILIO_TEMPLATE_SID_PROMOTION!, indexed)
    : sendViaMeta(to, "promotional_offer", indexed);
}
