export type ActionHandler = {
  credentialProvider?: string;
  execute(config: unknown, context: unknown, credential?: unknown): Promise<void>;
};

export class ActionError extends Error {
  constructor(
    public code: string,
    public outcome: "failed" | "retry" | "needs_attention",
    public retryAfterMs = 0,
  ) {
    super(code);
  }
}

export function getHandler(registry: Record<string, ActionHandler>, type: string): ActionHandler {
  if (!Object.hasOwn(registry, type)) throw new ActionError("UNSUPPORTED_ACTION", "failed");
  return registry[type]!;
}
