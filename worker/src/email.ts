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

export async function sendEmail(
  to: string,
  body: string,
  subject = "Hello from workflow",
): Promise<void> {
  if (!to || !body) throw new Error("Invalid email or body");
  // The caller classifies provider errors. Never log raw errors or message contents here.
  await transport.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text: body,
  });
}
