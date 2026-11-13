import { parseDiscordConnection } from "../connection-secrets.js";
import { renderText } from "../templates.js";
import { ActionError } from "./registry.js";
import type { ActionHandler } from "./registry.js";
import { postJson } from "./http.js";
import type { Fetch } from "./http.js";
export function createDiscordHandler(fetcher: Fetch = fetch): ActionHandler {
  return {
    credentialProvider: "discord.webhook",
    async execute(config, context, credential) {
      let connection;
      try {
        connection = parseDiscordConnection(credential);
      } catch {
        throw new ActionError("INVALID_DISCORD_CONNECTION", "failed");
      }
      const settings = config as { text?: unknown } | null;
      if (!settings || typeof settings.text !== "string")
        throw new ActionError("INVALID_DISCORD_CONFIG", "failed");
      const content = renderText(settings.text, context, 2000);
      if (!content.trim()) throw new ActionError("INVALID_DISCORD_CONFIG", "failed");
      // wait=true confirms the message was saved; untrusted event text cannot ping members.
      const response = await postJson(fetcher, `${connection.webhookUrl}?wait=true`, {
        content,
        allowed_mentions: { parse: [] },
        flags: 4,
      });
      try {
        const message = (await response.json()) as { id?: unknown };
        if (!message || typeof message.id !== "string" || !/^[0-9]{17,20}$/.test(message.id))
          throw new Error();
      } catch {
        throw new ActionError("DISCORD_OUTCOME_UNKNOWN", "needs_attention");
      }
    },
  };
}
