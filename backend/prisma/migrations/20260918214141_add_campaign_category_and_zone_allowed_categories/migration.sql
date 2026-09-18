-- AlterTable
ALTER TABLE "AdZone" ADD COLUMN     "allowedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "category" TEXT,
ALTER COLUMN "targetOperatingSystems" DROP DEFAULT;
