import { parseGoogleConnection } from "../connection-secrets.js";
import { renderCell } from "../templates.js";
import { googleAccessToken } from "../google-token.js";
import { ActionError } from "./registry.js";
import type { ActionHandler } from "./registry.js";
import { postJson } from "./http.js";
import type { Fetch } from "./http.js";
export function createSheetsHandler(
  fetcher: Fetch = fetch,
  getToken = googleAccessToken,
): ActionHandler {
  return {
    credentialProvider: "google.service_account",
    async execute(config, context, credential) {
      let connection;
      try {
        connection = parseGoogleConnection(credential);
      } catch {
        throw new ActionError("INVALID_GOOGLE_CONNECTION", "failed");
      }
      const settings = config as {
        spreadsheetId?: unknown;
        range?: unknown;
        values?: unknown;
      } | null;
      if (
        !settings ||
        typeof settings.spreadsheetId !== "string" ||
        !/^[A-Za-z0-9_-]{5,200}$/.test(settings.spreadsheetId) ||
        typeof settings.range !== "string" ||
        !settings.range.trim() ||
        settings.range.length > 200 ||
        /[{}\r\n]/.test(settings.range) ||
        !Array.isArray(settings.values) ||
        settings.values.length < 1 ||
        settings.values.length > 50 ||
        settings.values.some((v) => typeof v !== "string")
      ) {
        throw new ActionError("INVALID_SHEETS_CONFIG", "failed");
      }
      const values = settings.values.map((value) => renderCell(value as string, context));
      const token = await getToken(connection);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(settings.spreadsheetId)}/values/${encodeURIComponent(settings.range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
      const response = await postJson(
        fetcher,
        url,
        { majorDimension: "ROWS", values: [values] },
        { Authorization: `Bearer ${token}` },
      );
      try {
        const result = (await response.json()) as { updates?: { updatedRows?: number } };
        if (result.updates?.updatedRows !== 1) throw new Error();
      } catch {
        throw new ActionError("SHEETS_OUTCOME_UNKNOWN", "needs_attention");
      }
    },
  };
}
