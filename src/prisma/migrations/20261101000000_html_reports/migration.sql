CREATE TABLE "html_report" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "userId" TEXT,
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "html_report_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "html_report_objectKey_key" ON "html_report"("objectKey");
CREATE INDEX "html_report_userId_idx" ON "html_report"("userId");
CREATE INDEX "html_report_conversationId_idx" ON "html_report"("conversationId");
CREATE INDEX "html_report_createdAt_id_idx" ON "html_report"("createdAt", "id");

ALTER TABLE "html_report" ADD CONSTRAINT "html_report_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "html_report" ADD CONSTRAINT "html_report_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "will_gpt_conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
