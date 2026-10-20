CREATE TABLE "event_door_totals" (
    "eventId" TEXT NOT NULL,
    "cashTickets" INTEGER NOT NULL DEFAULT 0,
    "cashCents" INTEGER NOT NULL DEFAULT 0,
    "eftposTickets" INTEGER NOT NULL DEFAULT 0,
    "eftposCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "event_door_totals_pkey" PRIMARY KEY ("eventId"),
    CONSTRAINT "event_door_totals_counts_check" CHECK (
      "cashTickets" BETWEEN 0 AND 1000000 AND "eftposTickets" BETWEEN 0 AND 1000000
      AND "cashCents" BETWEEN 0 AND 1000000000 AND "eftposCents" BETWEEN 0 AND 1000000000
      AND ("cashCents" = 0 OR "cashTickets" > 0)
      AND ("eftposCents" = 0 OR "eftposTickets" > 0)
    ),
    CONSTRAINT "event_door_totals_eventId_fkey" FOREIGN KEY ("eventId")
      REFERENCES "ticket_event"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
