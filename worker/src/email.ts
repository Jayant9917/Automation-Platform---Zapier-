import { config } from "./config.js";
import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  requireTLS: !config.smtp.secure && config.smtp.requireTLS,
  ...(config.smtp.auth ? { auth: { user: config.smtp.user, pass: config.smtp.password } } : {}),
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 30000,
});

export async function sendEmail(to: string, body: string): Promise<void> {
  try {
    if (!to || !body) {
      throw new Error(`Invalid email or body: to=${to}, body=${body}`);
    }

    const from = config.smtp.from;
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
