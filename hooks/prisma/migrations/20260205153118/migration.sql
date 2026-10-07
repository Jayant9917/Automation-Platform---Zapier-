/*
  Warnings:

  - You are about to drop the column `SortingOrder` on the `Trigger` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Action" ADD COLUMN     "sortingOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Trigger" DROP COLUMN "SortingOrder";
