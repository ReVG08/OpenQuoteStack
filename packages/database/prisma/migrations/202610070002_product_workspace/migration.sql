-- AlterTable
ALTER TABLE "Estimator" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "draftDefinition" JSONB,
ADD COLUMN     "draftVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Estimate" ALTER COLUMN "status" SET DEFAULT 'new';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "address" TEXT,
ADD COLUMN     "company" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "QuoteSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "estimatorId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastStep" INTEGER NOT NULL DEFAULT 0,
    "estimateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimateActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimateActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuoteSession_estimateId_key" ON "QuoteSession"("estimateId");

-- CreateIndex
CREATE INDEX "QuoteSession_organizationId_createdAt_idx" ON "QuoteSession"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteSession_estimateId_organizationId_key" ON "QuoteSession"("estimateId", "organizationId");

-- CreateIndex
CREATE INDEX "EstimateActivity_organizationId_estimateId_createdAt_idx" ON "EstimateActivity"("organizationId", "estimateId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuoteSession" ADD CONSTRAINT "QuoteSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSession" ADD CONSTRAINT "QuoteSession_revisionId_organizationId_estimatorId_fkey" FOREIGN KEY ("revisionId", "organizationId", "estimatorId") REFERENCES "EstimatorRevision"("id", "organizationId", "estimatorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSession" ADD CONSTRAINT "QuoteSession_estimateId_organizationId_fkey" FOREIGN KEY ("estimateId", "organizationId") REFERENCES "Estimate"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateActivity" ADD CONSTRAINT "EstimateActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimateActivity" ADD CONSTRAINT "EstimateActivity_estimateId_organizationId_fkey" FOREIGN KEY ("estimateId", "organizationId") REFERENCES "Estimate"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;


UPDATE "Estimate" SET "status" = CASE "status" WHEN 'completed' THEN 'new'::"EstimateStatus" WHEN 'accepted' THEN 'won'::"EstimateStatus" WHEN 'declined' THEN 'lost'::"EstimateStatus" ELSE "status" END;
