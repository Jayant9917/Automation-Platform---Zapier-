import { renderText } from "../templates.js";
import { ActionError } from "./registry.js";
import type { ActionHandler } from "./registry.js";

// Dependency injection lets unit tests exercise the handler without SMTP.
export function createEmailHandler(
  sendEmail: (to: string, body: string, subject?: string) => Promise<void>,
): ActionHandler {
  return {
    async execute(config, context) {
      const settings = config as { email?: unknown; body?: unknown; subject?: unknown } | null;
      if (
        !settings ||
        typeof settings.email !== "string" ||
        (settings.subject !== undefined && typeof settings.subject !== "string") ||
        typeof settings.body !== "string" ||
        !settings.body.trim()
      ) {
        throw new ActionError("INVALID_EMAIL_CONFIG", "failed");
      }
      const to = renderText(settings.email, context, 320);
      const body = renderText(settings.body, context, 20000);
      const subject = renderText(
        typeof settings.subject === "string" ? settings.subject : "Hello from workflow",
        context,
        200,
      );
      if (
        !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to) ||
        !body.trim() ||
        !subject.trim() ||
        /[\r\n]/.test(subject)
      ) {
        throw new ActionError("INVALID_EMAIL_CONFIG", "failed");
      }
      try {
        if (settings.subject === undefined) await sendEmail(to, body);
        else await sendEmail(to, body, subject);
      } catch (error) {
        const smtp = error as { code?: string; responseCode?: number } | null;
        // An explicit SMTP rejection or failed connection is known not to be delivered.
        if (smtp?.responseCode && smtp.responseCode >= 400 && smtp.responseCode < 500) {
          throw new ActionError("SMTP_TEMPORARY_REJECTION", "retry");
        }
        if (smtp?.code === "ECONNREFUSED" || smtp?.code === "EDNS") {
          throw new ActionError("SMTP_UNAVAILABLE", "retry");
        }
        if (smtp?.code === "EAUTH" || (smtp?.responseCode && smtp.responseCode >= 500)) {
          throw new ActionError("SMTP_REJECTED", "failed");
        }
        // A timeout/reset might happen after SMTP accepted the email. Do not blindly resend.
        throw new ActionError("SMTP_OUTCOME_UNKNOWN", "needs_attention");
      }
    },
  };
}
