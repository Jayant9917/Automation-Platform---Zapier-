const nextJest = require("next/jest");
const createJestConfig = nextJest({ dir: "./" });
module.exports = createJestConfig({
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/tests/**/*.test.jsx", "<rootDir>/tests/**/*.test.cjs"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.cjs"],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    "components/workflow/WorkflowCanvas.tsx",
    "components/ui/Modal.tsx",
    "components/workflow/WorkflowNode.tsx",
    "lib/actions.ts",
    "components/workflow/ActionListEditor.tsx",
    "components/workflow/ConnectionManager.tsx",
    "components/workflow/WorkflowActionsPanel.tsx",
    "app/**/zap/create/page.tsx",
    "components/ui/Button.tsx",
    "components/ui/Input.tsx",
    "app/config.ts",
    "components/workflow/GitHubTriggerSetup.tsx",
    "components/workflow/TallyTriggerSetup.tsx",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json-summary"],
  coverageThreshold: { global: { branches: 80, functions: 85, lines: 85, statements: 85 } },
});
