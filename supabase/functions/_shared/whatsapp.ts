// Shared WhatsApp helper — imported by both edge functions via relative import
// Usage: import { sendTemplate } from "../_shared/whatsapp.ts";

export type Provider = "twilio" | "meta";

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendTemplate(
  to: string,
  /** Twilio: ContentSid  |  Meta: template name */
  templateId: string,
  variables: Record<string, string>,
  provider: Provider = "twilio"
): Promise<SendResult> {
  return provider === "twilio"
    ? sendViaTwilio(to, templateId, variables)
    : sendViaMeta(to, templateId, variables);
}

async function sendViaTwilio(
  to: string,
  contentSid: string,
  variables: Record<string, string>
): Promise<SendResult> {
  const sid  = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const tok  = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM")!;

  const body = new URLSearchParams({
    From:             `whatsapp:${from}`,
    To:               `whatsapp:${to}`,
    ContentSid:       contentSid,
    ContentVariables: JSON.stringify(variables),
  });

  const res  = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${tok}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );
  const data = await res.json();
  return res.ok
    ? { success: true, messageId: data.sid }
    : { success: false, error: data.message };
}

async function sendViaMeta(
  to: string,
  templateName: string,
  variables: Record<string, string>
): Promise<SendResult> {
  const phoneId = Deno.env.get("META_PHONE_NUMBER_ID")!;
  const token   = Deno.env.get("META_ACCESS_TOKEN")!;

  const parameters = Object.values(variables).map((text) => ({
    type: "text",
    text,
  }));

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: "en" },
          components: [{ type: "body", parameters }],
        },
      }),
    }
  );
  const data = await res.json();
  return res.ok
    ? { success: true, messageId: data.messages?.[0]?.id }
    : { success: false, error: data.error?.message };
}
