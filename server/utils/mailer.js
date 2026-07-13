import nodemailer from "nodemailer";

// SMTP via env (works with a Gmail app password, or any provider). If SMTP
// isn't configured, fall back to logging the message so the flow is testable
// in dev without credentials.
// ponytail: single reusable transport, no queue/retry; add one only if volume grows.
let transport;
function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      requireTLS: true, // enforce STARTTLS on 587; fail loud instead of silent downgrade
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

export async function sendMail({ to, subject, text }) {
  const t = getTransport();
  if (!t) {
    console.log(`[mailer] SMTP not configured — would send to ${to}:\n${subject}\n${text}`);
    return;
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
}
