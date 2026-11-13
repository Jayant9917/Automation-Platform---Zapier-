const mockCreateTransport = jest.fn();
const mockSmtp = {
  host: "smtp.test",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: true,
  user: "unit",
  password: "unit-secret",
  from: "sender@example.test",
};
jest.mock("nodemailer", () => ({ createTransport: mockCreateTransport }));
jest.mock("../src/config.ts", () => ({ config: { smtp: mockSmtp } }));
const nodemailer = require("nodemailer");
const config = { smtp: mockSmtp };
let sendMail, sendEmail;
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  sendMail = jest.fn().mockResolvedValue({ messageId: "unit-message" });
  nodemailer.createTransport.mockReturnValue({ sendMail });
  jest.isolateModules(() => {
    sendEmail = require("../src/email.ts").sendEmail;
  });
});
test("builds an authenticated transport with bounded network timeouts", () => {
  expect(nodemailer.createTransport).toHaveBeenCalledWith(
    expect.objectContaining({
      host: "smtp.test",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: "unit", pass: "unit-secret" },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
    }),
  );
});
test("passes the configured sender, recipient and body to the mocked transport", async () => {
  await sendEmail("recipient@example.test", "Hello");
  expect(sendMail).toHaveBeenCalledWith({
    from: "sender@example.test",
    to: "recipient@example.test",
    subject: "Hello from workflow",
    text: "Hello",
  });
});
test.each([
  ["", "Hello"],
  ["recipient@example.test", ""],
])("rejects missing recipient/body", async (to, body) => {
  await expect(sendEmail(to, body)).rejects.toThrow("Invalid email or body");
  expect(sendMail).not.toHaveBeenCalled();
});
test("propagates SMTP failure for the caller to handle", async () => {
  const error = new Error("SMTP unavailable");
  sendMail.mockRejectedValue(error);
  await expect(sendEmail("recipient@example.test", "Hello")).rejects.toBe(error);
});
test("handles a successful response without a message ID", async () => {
  sendMail.mockResolvedValue({});
  await expect(sendEmail("recipient@example.test", "Hello")).resolves.toBeUndefined();
});
test("can configure an explicitly unauthenticated development sink", () => {
  config.smtp.auth = false;
  config.smtp.requireTLS = false;
  try {
    jest.isolateModules(() => require("../src/email.ts"));
    const options = nodemailer.createTransport.mock.calls.at(-1)[0];
    expect(options).not.toHaveProperty("auth");
    expect(options.requireTLS).toBe(false);
  } finally {
    config.smtp.auth = true;
    config.smtp.requireTLS = true;
  }
});
test("does not require STARTTLS when implicit TLS is configured", () => {
  config.smtp.secure = true;
  try {
    jest.isolateModules(() => require("../src/email.ts"));
    expect(nodemailer.createTransport.mock.calls.at(-1)[0].requireTLS).toBe(false);
  } finally {
    config.smtp.secure = false;
  }
});

test("accepts a configured dynamic subject", async () => {
  await sendEmail("unit@test.dev", "Body", "Issue: Bug");
  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ subject: "Issue: Bug" }));
});
