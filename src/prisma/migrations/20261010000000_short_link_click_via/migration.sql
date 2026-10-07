-- Short link clicks: whether each one came through a QR code (`?qr=1`) or a
-- plain link. Null on clicks from before it was recorded. Additive only, so
-- `prisma db push` alone is also safe; this is here for the record.

ALTER TABLE "short_link_click" ADD COLUMN "via" TEXT;
