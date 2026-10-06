-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'admin', 'sales', 'viewer');

-- CreateEnum
CREATE TYPE "EstimatorStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('completed', 'accepted', 'declined');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "branding" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimator" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EstimatorStatus" NOT NULL DEFAULT 'draft',
    "publishedRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Estimator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstimatorRevision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "estimatorId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstimatorRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "estimatorId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_organizationId_userId_key" ON "Membership"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Estimator_publishedRevisionId_key" ON "Estimator"("publishedRevisionId");

-- CreateIndex
CREATE INDEX "Estimator_organizationId_status_idx" ON "Estimator"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Estimator_id_organizationId_key" ON "Estimator"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Estimator_publishedRevisionId_organizationId_id_key" ON "Estimator"("publishedRevisionId", "organizationId", "id");

-- CreateIndex
CREATE INDEX "EstimatorRevision_organizationId_idx" ON "EstimatorRevision"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "EstimatorRevision_estimatorId_number_key" ON "EstimatorRevision"("estimatorId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "EstimatorRevision_id_organizationId_estimatorId_key" ON "EstimatorRevision"("id", "organizationId", "estimatorId");

-- CreateIndex
CREATE INDEX "Estimate_organizationId_createdAt_idx" ON "Estimate"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_id_organizationId_key" ON "Estimate"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_estimateId_key" ON "Lead"("estimateId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_idx" ON "Lead"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_estimateId_organizationId_key" ON "Lead"("estimateId", "organizationId");

-- CreateIndex
CREATE INDEX "AuditEntry_organizationId_createdAt_idx" ON "AuditEntry"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimator" ADD CONSTRAINT "Estimator_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimator" ADD CONSTRAINT "Estimator_publishedRevisionId_organizationId_id_fkey" FOREIGN KEY ("publishedRevisionId", "organizationId", "id") REFERENCES "EstimatorRevision"("id", "organizationId", "estimatorId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "EstimatorRevision" ADD CONSTRAINT "EstimatorRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstimatorRevision" ADD CONSTRAINT "EstimatorRevision_estimatorId_organizationId_fkey" FOREIGN KEY ("estimatorId", "organizationId") REFERENCES "Estimator"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_revisionId_organizationId_estimatorId_fkey" FOREIGN KEY ("revisionId", "organizationId", "estimatorId") REFERENCES "EstimatorRevision"("id", "organizationId", "estimatorId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_estimateId_organizationId_fkey" FOREIGN KEY ("estimateId", "organizationId") REFERENCES "Estimate"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Retained snapshots are append-only, including unpublished candidate revisions.
CREATE FUNCTION oqs_immutable_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Estimator revisions are immutable';
END;
$$;
CREATE TRIGGER immutable_revision BEFORE UPDATE OR DELETE ON "EstimatorRevision"
FOR EACH ROW EXECUTE FUNCTION oqs_immutable_revision();

-- Status may change; the calculation, ownership and revision link may not.
CREATE FUNCTION oqs_immutable_estimate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Retained estimates cannot be deleted'; END IF;
  IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
    RAISE EXCEPTION 'Estimate calculation snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER immutable_estimate BEFORE UPDATE OR DELETE ON "Estimate"
FOR EACH ROW EXECUTE FUNCTION oqs_immutable_estimate();
