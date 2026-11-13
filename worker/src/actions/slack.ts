import { parseSlackConnection } from "../connection-secrets.js";
import { renderText } from "../templates.js";
import { ActionError } from "./registry.js";
import type { ActionHandler } from "./registry.js";
import { postJson } from "./http.js";
import type { Fetch } from "./http.js";
export function createSlackHandler(fetcher: Fetch = fetch): ActionHandler {
  return {
    credentialProvider: "slack.webhook",
    async execute(config, context, credential) {
      let connection;
      try {
        connection = parseSlackConnection(credential);
      } catch {
        throw new ActionError("INVALID_SLACK_CONNECTION", "failed");
      }
      const settings = config as { text?: unknown } | null;
      if (!settings || typeof settings.text !== "string")
        throw new ActionError("INVALID_SLACK_CONFIG", "failed");
      const text = renderText(settings.text, context, 3000);
      if (!text.trim()) throw new ActionError("INVALID_SLACK_CONFIG", "failed");
      // Plain-text blocks prevent event content from injecting Slack mentions or formatting.
      const fallback = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const response = await postJson(fetcher, connection.webhookUrl, {
        text: fallback,
        blocks: [{ type: "section", text: { type: "plain_text", text, emoji: false } }],
        unfurl_links: false,
        unfurl_media: false,
      });
      try {
        if ((await response.text()).trim() !== "ok") throw new Error();
      } catch {
        throw new ActionError("SLACK_OUTCOME_UNKNOWN", "needs_attention");
      }
    },
  };
}
