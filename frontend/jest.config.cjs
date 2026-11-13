const nextJest = require("next/jest");
const createJestConfig = nextJest({ dir: "./" });
module.exports = createJestConfig({
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/tests/**/*.test.jsx", "<rootDir>/tests/**/*.test.cjs"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.cjs"],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ["components/ui/Button.tsx", "components/ui/Input.tsx", "app/config.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json-summary"],
  coverageThreshold: { global: { branches: 80, functions: 85, lines: 85, statements: 85 } },
});
