-- Additive migration: existing workflows and run/outbox data are retained.
ALTER TABLE "ZapRun" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE TABLE "ActionRun" (
  "id" TEXT NOT NULL,
  "zapRunId" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimToken" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionRun_zapRunId_fkey" FOREIGN KEY ("zapRunId") REFERENCES "ZapRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ActionRun_zapRunId_actionId_key" ON "ActionRun"("zapRunId", "actionId");
CREATE INDEX "ActionRun_status_nextAttemptAt_dispatchAfter_idx" ON "ActionRun"("status", "nextAttemptAt", "dispatchAfter");
CREATE TABLE "LegacyJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "leaseUntil" TIMESTAMP(3),
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ActionRun_status_leaseUntil_idx" ON "ActionRun"("status", "leaseUntil");
CREATE INDEX "LegacyJob_status_leaseUntil_idx" ON "LegacyJob"("status", "leaseUntil");
