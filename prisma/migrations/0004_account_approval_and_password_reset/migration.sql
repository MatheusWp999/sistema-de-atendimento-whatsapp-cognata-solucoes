ALTER TABLE "Company"
ADD COLUMN "accountStatus" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "planKey" TEXT,
ADD COLUMN "planApprovedAt" TIMESTAMP(3),
ADD COLUMN "planApprovedByUserId" TEXT;

UPDATE "Company"
SET "planKey" = 'PROFESSIONAL', "planApprovedAt" = CURRENT_TIMESTAMP
WHERE "accountStatus" = 'APPROVED' AND "planKey" IS NULL;

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

ALTER TABLE "PasswordResetToken"
ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
