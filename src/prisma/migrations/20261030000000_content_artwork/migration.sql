ALTER TABLE "content_item" ADD COLUMN "imageFileUploadId" TEXT;

CREATE INDEX "content_item_imageFileUploadId_idx" ON "content_item"("imageFileUploadId");

ALTER TABLE "content_item" ADD CONSTRAINT "content_item_imageFileUploadId_fkey"
FOREIGN KEY ("imageFileUploadId") REFERENCES "file_upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
