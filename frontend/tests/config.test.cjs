const originalEnv = process.env;
beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});
afterEach(() => {
  process.env = originalEnv;
});
test("defaults to same-origin Docker gateway URLs", () => {
  delete process.env.NEXT_PUBLIC_BACKEND_URL;
  delete process.env.NEXT_PUBLIC_HOOKS_URL;
  const config = require("../app/config.ts");
  expect(config.BACKEND_URL).toBe("");
  expect(config.HOOKS_URL).toBe("");
});
test("normalizes explicit URL overrides", () => {
  process.env.NEXT_PUBLIC_BACKEND_URL = " https://api.example.test/ ";
  process.env.NEXT_PUBLIC_HOOKS_URL = " https://hooks.example.test/ ";
  const config = require("../app/config.ts");
  expect(config.BACKEND_URL).toBe("https://api.example.test");
  expect(config.HOOKS_URL).toBe("https://hooks.example.test");
});
