-- Views of every public page, one row per visit and page, for the Site tab on
-- Analytics. Additive only.

-- CreateTable
CREATE TABLE "page_view" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "device" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_view_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_view_createdAt_idx" ON "page_view"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "page_view_path_visitId_key" ON "page_view"("path", "visitId");
