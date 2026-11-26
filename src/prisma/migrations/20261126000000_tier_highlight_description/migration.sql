-- A tier's description can show in red on the buy panel.

ALTER TABLE "ticket_tier" ADD COLUMN "highlightDescription" BOOLEAN NOT NULL DEFAULT false;
