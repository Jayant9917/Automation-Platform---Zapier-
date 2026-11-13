// Versioned queue contract. Handler configuration is loaded from the immutable ActionRun.
export function createActionJob(run: { id: string; zapRunId: string }) {
  return { version: 1 as const, executionId: run.zapRunId, actionExecutionId: run.id };
}
