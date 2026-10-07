-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstimateStatus" ADD VALUE 'new';
ALTER TYPE "EstimateStatus" ADD VALUE 'contacted';
ALTER TYPE "EstimateStatus" ADD VALUE 'qualified';
ALTER TYPE "EstimateStatus" ADD VALUE 'won';
ALTER TYPE "EstimateStatus" ADD VALUE 'lost';
ALTER TYPE "EstimateStatus" ADD VALUE 'archived';

