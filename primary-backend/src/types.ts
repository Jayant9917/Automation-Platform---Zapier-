import { z } from "zod";

export const SignupSchema = z.object({
    username: z.string().email(),
    password: z.string().min(6),
    name: z.string()
});

export const SigninSchema = z.object({
    username: z.string().email(),
    password: z.string()
});

export const ZapCreateSchema = z.object({
    availableTriggerId: z.string(),
    actions: z.array(z.object({
        availableActionId: z.string(),
        actionMetadata: z.record(z.unknown())
    }))
});
