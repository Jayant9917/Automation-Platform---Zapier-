/*
  Warnings:

  - Added the required column `image` to the `AvailableActions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `image` to the `AvailableTriggers` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Zap_user_id_key";

-- AlterTable
ALTER TABLE "AvailableActions" ADD COLUMN     "image" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AvailableTriggers" ADD COLUMN     "image" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Trigger" ADD COLUMN     "Metadata" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Zap" ALTER COLUMN "user_id" DROP DEFAULT;
DROP SEQUENCE "Zap_user_id_seq";
