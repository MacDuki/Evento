import nodemailer from "nodemailer";
import OpenAI from "openai";
import webpush from "web-push";

export async function coachReflection(reflection: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return "Coach no configurado. Reflexiona con honestidad sobre tu propósito, tu templanza y el siguiente acto concreto de responsabilidad.";
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    instructions: "Actúa como Coach Reflexivo. Combina gracia, paz y propósito cristianos no dogmáticos con autocontrol, templanza y claridad estoicos. Sé empático, firme y breve. No decidas estados del ciclo.",
    input: reflection
  });
  return response.output_text;
}

export async function notifyContacts(subject: string, text: string, recipients: string[]): Promise<void> {
  if (process.env.ACCOUNTABILITY_ENABLED !== "true" || recipients.length === 0) return;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error("ACCOUNTABILITY_ENABLED requiere configuración SMTP completa");
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
  await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: recipients, subject, text });
}

export function configurePush(): void {
  if (process.env.WEB_PUSH_ENABLED === "true") {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
      throw new Error("WEB_PUSH_ENABLED requiere claves VAPID");
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  }
}
