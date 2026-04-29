/*
  Warnings:

  - You are about to drop the column `processingStatus` on the `Dispute` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Dispute_processingStatus_idx";

-- AlterTable
ALTER TABLE "Dispute" DROP COLUMN "processingStatus";

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "pdfsGenerated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "performanceFeeOwed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "revenueRecovered" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "customerIp" TEXT,
ADD COLUMN     "deviceFingerprint" TEXT,
ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
