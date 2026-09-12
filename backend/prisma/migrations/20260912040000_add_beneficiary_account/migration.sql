-- CreateEnum
CREATE TYPE "BeneficiaryAccountType" AS ENUM ('BANK_ACCOUNT', 'VPA');

-- CreateTable
CREATE TABLE "BeneficiaryAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountType" "BeneficiaryAccountType" NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "bankAccountNumber" TEXT,
    "ifscCode" TEXT,
    "vpa" TEXT,
    "razorpayContactId" TEXT,
    "razorpayFundAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeneficiaryAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BeneficiaryAccount_userId_key" ON "BeneficiaryAccount"("userId");

-- AddForeignKey
ALTER TABLE "BeneficiaryAccount" ADD CONSTRAINT "BeneficiaryAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
