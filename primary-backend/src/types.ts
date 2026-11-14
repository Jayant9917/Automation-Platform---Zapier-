import { TallySetupSchema } from "./tally-setup.js";
import { ScheduleSchema } from "./schedule-setup.js";
import { z } from "zod";
import { GitHubSetupSchema } from "./github-setup.js";
import { ActionsSchema } from "./action-config.js";

export const SignupSchema = z.object({
  username: z.string().email(),
  password: z.string().min(6),
  name: z.string(),
});

export const SigninSchema = z.object({
  username: z.string().email(),
  password: z.string(),
});

export const ZapCreateSchema = z.object({
  availableTriggerId: z.enum([
    "webhook",
    "schedule",
    "tally.form_submitted",
    "github.issue_opened",
    "github.issue_closed",
    "github.pull_request_opened",
  ]),
  actions: ActionsSchema,
  schedule: ScheduleSchema.optional(),
  github: GitHubSetupSchema.optional(),
  tally: TallySetupSchema.optional(),
});
