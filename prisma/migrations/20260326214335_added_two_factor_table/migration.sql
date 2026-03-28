-- CreateTable
CREATE TABLE "StaffTwoFactorChallenge" (
    "id" TEXT NOT NULL,
    "staff_member_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "last_code_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivery_method" TEXT NOT NULL DEFAULT 'EMAIL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffTwoFactorChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffTwoFactorChallenge_staff_member_id_idx" ON "StaffTwoFactorChallenge"("staff_member_id");

-- CreateIndex
CREATE INDEX "StaffTwoFactorChallenge_expires_at_idx" ON "StaffTwoFactorChallenge"("expires_at");

-- AddForeignKey
ALTER TABLE "StaffTwoFactorChallenge" ADD CONSTRAINT "StaffTwoFactorChallenge_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
