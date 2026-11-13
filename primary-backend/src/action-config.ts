import { z } from "zod";
import { validTemplate } from "./templates.js";
const template = (limit: number) =>
  z
    .string()
    .min(1)
    .max(limit)
    .refine((value) => !!value.trim() && validTemplate(value), "Invalid template");
const base = { id: z.string().uuid().optional() };
export function spreadsheetId(input: string): string {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{5,200}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const match = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{5,200})(?:\/|$)/.exec(url.pathname);
    if (
      url.protocol === "https:" &&
      url.hostname === "docs.google.com" &&
      !url.username &&
      !url.password &&
      match
    )
      return match[1]!;
  } catch {
    /* Return a safe validation error, not the submitted URL. */
  }
  throw new Error("INVALID_SPREADSHEET");
}
export const ActionSchema = z.discriminatedUnion("availableActionId", [
  z.object({
    ...base,
    availableActionId: z.literal("discord.send_message"),
    credentialId: z.string().uuid(),
    actionMetadata: z.object({ text: template(2000) }).strict(),
  }),
  z.object({
    ...base,
    availableActionId: z.literal("email"),
    credentialId: z.null().optional(),
    actionMetadata: z
      .object({
        email: template(320).refine(
          (value) => value.includes("{{") || /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value),
        ),
        subject: template(200)
          .refine((value) => !/[\r\n]/.test(value))
          .default("Hello from workflow"),
        body: template(20000),
      })
      .strict(),
  }),
  z.object({
    ...base,
    availableActionId: z.literal("slack.send_message"),
    credentialId: z.string().uuid(),
    actionMetadata: z.object({ text: template(3000) }).strict(),
  }),
  z.object({
    ...base,
    availableActionId: z.literal("google_sheets.append_row"),
    credentialId: z.string().uuid(),
    actionMetadata: z
      .object({
        spreadsheetId: z
          .string()
          .max(500)
          .transform((value, ctx) => {
            try {
              return spreadsheetId(value);
            } catch {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Invalid spreadsheet ID or URL",
              });
              return z.NEVER;
            }
          }),
        range: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .refine((value) => !/[{}\r\n]/.test(value)),
        values: z
          .array(z.string().max(40000).refine(validTemplate, "Invalid template"))
          .min(1)
          .max(50),
      })
      .strict(),
  }),
]);
export const ActionsSchema = z.array(ActionSchema).min(1).max(20);
export type ActionInput = z.infer<typeof ActionSchema>;
export const actionProviders: Record<string, string> = {
  "discord.send_message": "discord.webhook",
  "slack.send_message": "slack.webhook",
  "google_sheets.append_row": "google.service_account",
};
