module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.cjs"],
  clearMocks: true,
  restoreMocks: true,
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "CommonJS",
          moduleResolution: "Node",
          verbatimModuleSyntax: false,
          esModuleInterop: true,
          target: "ES2022",
        },
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  collectCoverageFrom: [
    "src/templates.ts",
    "src/http-config.ts",
    "src/credentials.ts",
    "src/connection-secrets.ts",
    "src/google-token.ts",

    "src/config.ts",
    "src/email.ts",
    "src/jobs.ts",
    "src/actions/*.ts",
    "src/execution.ts",
    "src/legacy.ts",
    "src/message-handler.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json-summary"],
  coverageThreshold: { global: { branches: 80, functions: 85, lines: 85, statements: 85 } },
};
