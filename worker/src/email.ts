import nodemailer from "nodemailer";

const host = process.env.SMTP_ENDPOINT;
const user = process.env.SMTP_USERNAME;
const pass = process.env.SMTP_PASSWORD;

if (!host || !user || !pass) {
  console.warn(
    "SMTP not fully configured: SMTP_ENDPOINT, SMTP_USERNAME, SMTP_PASSWORD must be set. Email sending will fail."
  );
}

const transport = nodemailer.createTransport({
  host,
  port: 587,
  secure: false,
  requireTLS: true,
  auth: { user, pass },
});

export async function sendEmail(to: string, body: string): Promise<void> {
  try {
    if (!to || !body) {
      throw new Error(`Invalid email or body: to=${to}, body=${body}`);
    }

    const from = process.env.SMTP_USERNAME || process.env.SMTP_FROM || "noreply@localhost";
    const info = await transport.sendMail({
      from,
      to,
      subject: "Hello from workflow",
      text: body,
    });

    console.log(`✅ Email sent to ${to}`, info.messageId ? `messageId=${info.messageId}` : "");
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err);
    throw err; 
  }
}