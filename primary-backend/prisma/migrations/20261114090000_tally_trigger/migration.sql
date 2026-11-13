-- Additive Tally trigger settings and submission receipts.
CREATE TABLE "TallyTrigger" (
 "workflowId" TEXT NOT NULL PRIMARY KEY, "formId" TEXT NOT NULL, "credentialId" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT true, "revision" INTEGER NOT NULL DEFAULT 1,
 CONSTRAINT "TallyTrigger_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Zap"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "TallyTrigger_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TallyTrigger_credentialId_key" ON "TallyTrigger"("credentialId");
CREATE TABLE "TallyDelivery" (
 "id" TEXT NOT NULL PRIMARY KEY, "workflowId" TEXT NOT NULL, "deliveryId" TEXT NOT NULL,
 "payloadHash" TEXT NOT NULL, "zapRunId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TallyDelivery_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Zap"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "TallyDelivery_zapRunId_fkey" FOREIGN KEY ("zapRunId") REFERENCES "ZapRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TallyDelivery_zapRunId_key" ON "TallyDelivery"("zapRunId");
CREATE UNIQUE INDEX "TallyDelivery_workflowId_deliveryId_key" ON "TallyDelivery"("workflowId", "deliveryId");
