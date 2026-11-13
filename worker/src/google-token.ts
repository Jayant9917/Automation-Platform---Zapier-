import { JWT } from "google-auth-library";
import { ActionError } from "./actions/registry.js";
export async function googleAccessToken(credentials: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  try {
    const client = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      transporterOptions: { timeout: 15000, retry: false },
    });
    const result = await client.getAccessToken();
    if (!result.token) throw new ActionError("GOOGLE_AUTH_REJECTED", "failed");
    return result.token;
  } catch (error) {
    if (error instanceof ActionError) throw error;
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    // Authentication happens before appending, so a retry here cannot duplicate a row.
    throw new ActionError(
      "GOOGLE_AUTH_UNAVAILABLE",
      status && status >= 400 && status < 500 && status !== 429 ? "failed" : "retry",
    );
  }
}
