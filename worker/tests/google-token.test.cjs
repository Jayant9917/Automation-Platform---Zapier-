const mockGetAccessToken = jest.fn();
const mockJWT = jest.fn(() => ({ getAccessToken: mockGetAccessToken }));
jest.mock("google-auth-library", () => ({ JWT: mockJWT }));
const { googleAccessToken } = require("../src/google-token.ts");
const credentials = {
  client_email: "service@project.iam.gserviceaccount.com",
  private_key: "unit-test-key",
};
beforeEach(() => mockGetAccessToken.mockResolvedValue({ token: "unit-token" }));
test("uses the official client with fixed Sheets scope and bounded auth requests", async () => {
  await expect(googleAccessToken(credentials)).resolves.toBe("unit-token");
  expect(mockJWT).toHaveBeenCalledWith({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    transporterOptions: { timeout: 15000, retry: false },
  });
});
test("empty tokens are not used for writes", async () => {
  mockGetAccessToken.mockResolvedValue({ token: null });
  await expect(googleAccessToken(credentials)).rejects.toMatchObject({ outcome: "failed" });
});
test.each([
  [400, "failed"],
  [401, "failed"],
  [403, "failed"],
  [429, "retry"],
  [503, "retry"],
  [undefined, "retry"],
])("classifies pre-write auth failures %s", async (status, outcome) => {
  mockGetAccessToken.mockRejectedValue({ response: { status } });
  await expect(googleAccessToken(credentials)).rejects.toMatchObject({ outcome });
});
