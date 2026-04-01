-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffId" VARCHAR(64) NOT NULL,
    "staffEmail" VARCHAR(320) NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "targetUserUsername" VARCHAR(255),
    "targetUserId" VARCHAR(64),
    "payload" JSONB,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetUserUsername_idx" ON "AdminAuditLog"("targetUserUsername");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");
