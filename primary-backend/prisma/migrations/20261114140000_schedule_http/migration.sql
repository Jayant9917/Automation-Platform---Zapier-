CREATE TABLE "ScheduleTrigger" (
 "workflowId" TEXT NOT NULL PRIMARY KEY, "frequency" TEXT NOT NULL,
 "hour" INTEGER NOT NULL DEFAULT 9, "minute" INTEGER NOT NULL DEFAULT 0,
 "enabled" BOOLEAN NOT NULL DEFAULT true, "nextRunAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ScheduleTrigger_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Zap"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ScheduleTrigger_frequency_check" CHECK ("frequency" IN ('every_5_minutes','daily')),
 CONSTRAINT "ScheduleTrigger_time_check" CHECK ("hour" BETWEEN 0 AND 23 AND "minute" BETWEEN 0 AND 59)
);
CREATE INDEX "ScheduleTrigger_enabled_nextRunAt_idx" ON "ScheduleTrigger"("enabled", "nextRunAt");
INSERT INTO "AvailableTriggers" ("id","name","image") VALUES ('schedule','Schedule','/schedule.svg') ON CONFLICT ("id") DO NOTHING;
INSERT INTO "AvailableActions" ("id","name","image") VALUES ('http.request','HTTP request','/http.svg') ON CONFLICT ("id") DO NOTHING;
