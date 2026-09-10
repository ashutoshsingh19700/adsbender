-- CreateEnum
CREATE TYPE "AdminScope" AS ENUM ('MASTER', 'PUBLISHER', 'ADVERTISER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminScope" "AdminScope";
