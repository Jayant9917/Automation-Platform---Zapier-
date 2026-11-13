-- Add user-owned action connections; retain all existing workflow/run data.
ALTER TABLE "Zap" ADD COLUMN "actionsRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Credential" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Connection';
ALTER TABLE "Credential" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "Action" ADD COLUMN "credentialId" TEXT;
ALTER TABLE "ActionRun" ADD COLUMN "credentialId" TEXT;
ALTER TABLE "Action" ADD CONSTRAINT "Action_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionRun" ADD CONSTRAINT "ActionRun_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "Credential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
