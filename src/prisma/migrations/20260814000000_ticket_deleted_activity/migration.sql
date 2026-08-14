-- Deleting a ticket outright, as distinct from voiding it.
--
-- Once the row is gone the activity log is the only record that the ticket ever
-- existed, so the deletion gets its own type rather than borrowing
-- TICKET_VOIDED — "who deleted what, and why" has to be filterable.
--
-- `ALTER TYPE ... ADD VALUE` is additive and idempotent; nothing existing
-- changes, and no ticket moves.

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'TICKET_DELETED';
