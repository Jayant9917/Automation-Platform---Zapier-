const {
  encryptSecret,
  decryptSecret,
  readEncryptionKey,
  credentialContext,
} = require("../src/credentials.ts");
const key = "ab".repeat(32);
const context = credentialContext({ id: "credential", ownerId: 2, provider: "github.webhook" });
test("encrypts with a fresh nonce and roundtrips Unicode", () => {
  const secret = "unit-secret-\u2603";
  const first = encryptSecret(secret, key, context);
  expect(first).not.toContain(secret);
  expect(encryptSecret(secret, key, context)).not.toBe(first);
  expect(decryptSecret(first, key, context)).toBe(secret);
});
test("binds secrets to owner, ID, and provider", () => {
  const value = encryptSecret("private-secret", key, context);
  for (const other of [
    "3:credential:github.webhook",
    "2:other:github.webhook",
    "2:credential:slack.webhook",
  ]) {
    expect(() => decryptSecret(value, key, other)).toThrow("Credential could not be decrypted");
  }
  expect(() => decryptSecret(value, "cd".repeat(32), context)).toThrow(
    "Credential could not be decrypted",
  );
});
test.each([undefined, ""])("allows absent keys until credential features are used %s", (value) => {
  expect(readEncryptionKey(value)).toBeUndefined();
  expect(() => encryptSecret("secret", value, context)).toThrow();
  expect(() => decryptSecret("v1.a.b.c", value, context)).toThrow(
    "Credential could not be decrypted",
  );
});
test.each(["short", "x".repeat(64), "ab".repeat(33), " " + key])(
  "rejects malformed key %s",
  (value) => {
    expect(() => readEncryptionKey(value)).toThrow(/CREDENTIAL_ENCRYPTION_KEY/);
  },
);
test("accepts exactly 32 bytes encoded as hex", () =>
  expect(readEncryptionKey(key.toUpperCase())).toBe(key.toUpperCase()));
test("rejects empty secrets", () =>
  expect(() => encryptSecret("", key, context)).toThrow("must not be empty"));
test.each(["bad", "v2.a.b.c", "v1.a.b.!", "v1..b.c", "v1.a.b.c", "v1.AAAAAAAAAAAAAAAA.b.c"])(
  "rejects malformed envelopes %s",
  (value) =>
    expect(() => decryptSecret(value, key, context)).toThrow("Credential could not be decrypted"),
);
test("detects modified ciphertext and authentication tags", () => {
  const value = encryptSecret("unit-secret", key, context).split(".");
  for (const index of [2, 3]) {
    const edited = [...value];
    const bytes = Buffer.from(edited[index], "base64url");
    bytes[0] ^= 1;
    edited[index] = bytes.toString("base64url");
    expect(() => decryptSecret(edited.join("."), key, context)).toThrow(
      "Credential could not be decrypted",
    );
  }
});
