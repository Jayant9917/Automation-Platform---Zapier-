-- Additive: existing workflows, events, and action runs are retained.
CREATE TABLE "Credential" (
 "id" TEXT NOT NULL PRIMARY KEY, "ownerId" INTEGER NOT NULL, "provider" TEXT NOT NULL,
 "encryptedSecret" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "Credential_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Credential_ownerId_provider_idx" ON "Credential"("ownerId", "provider");
CREATE TABLE "GithubTrigger" (
 "workflowId" TEXT NOT NULL PRIMARY KEY, "repository" TEXT NOT NULL, "credentialId" TEXT NOT NULL,
 "enabled" BOOLEAN NOT NULL DEFAULT true, "revision" INTEGER NOT NULL DEFAULT 1,
 CONSTRAINT "GithubTrigger_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Zap"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "GithubTrigger_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GithubTrigger_credentialId_key" ON "GithubTrigger"("credentialId");
CREATE TABLE "GithubDelivery" (
 "id" TEXT NOT NULL PRIMARY KEY, "workflowId" TEXT NOT NULL, "deliveryId" TEXT NOT NULL,
 "payloadHash" TEXT NOT NULL, "zapRunId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "GithubDelivery_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Zap"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "GithubDelivery_zapRunId_fkey" FOREIGN KEY ("zapRunId") REFERENCES "ZapRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GithubDelivery_zapRunId_key" ON "GithubDelivery"("zapRunId");
CREATE UNIQUE INDEX "GithubDelivery_workflowId_deliveryId_key" ON "GithubDelivery"("workflowId", "deliveryId");
