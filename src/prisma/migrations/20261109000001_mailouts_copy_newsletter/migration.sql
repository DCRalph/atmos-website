-- Everyone on the old newsletter table becomes a member of Newsletter.
--
-- Safe to run again, and meant to be: run it before the deploy, then once
-- more after, to pick up anyone who signed up while the old code was still
-- live. After that the old table can be dropped.
INSERT INTO "mailing_list" ("id", "slug", "name", "description", "public", "updatedAt")
VALUES (gen_random_uuid()::text, 'newsletter', 'Newsletter', 'New gigs, ticket releases and what Atmos is up to.', true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "subscriber" ("id", "email", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, lower(trim(ns."email")), min(ns."createdAt"), CURRENT_TIMESTAMP
FROM "newsletter_subscription" ns
GROUP BY lower(trim(ns."email"))
ON CONFLICT ("email") DO NOTHING;

-- The old table never recorded how anyone joined, so the source is read back
-- from the two places that wrote to it besides the form. `removed` was only
-- ever set by an admin: there was no unsubscribe link. Checkout kept the
-- buyer's casing, so one person can have two old rows; if either was
-- removed, they stay removed.
INSERT INTO "list_membership" ("subscriberId", "listId", "source", "subscribedAt", "unsubscribedAt", "unsubscribedVia")
SELECT DISTINCT ON (s."id")
  s."id",
  l."id",
  COALESCE(
    (SELECT 'checkout:' || o."eventId" FROM "ticket_order" o
      WHERE o."marketingOptIn" AND lower(o."buyerEmail") = s."email"
      ORDER BY o."createdAt" LIMIT 1),
    (SELECT 'photo-signup:' || p."gigId" FROM "gig_photo_signup" p
      WHERE p."email" = s."email"
      ORDER BY p."createdAt" LIMIT 1),
    'newsletter-form'
  ),
  ns."createdAt",
  CASE WHEN ns."removed" THEN ns."updatedAt" END,
  CASE WHEN ns."removed" THEN 'ADMIN'::"UnsubscribeVia" END
FROM "newsletter_subscription" ns
JOIN "subscriber" s ON s."email" = lower(trim(ns."email"))
JOIN "mailing_list" l ON l."slug" = 'newsletter'
ORDER BY s."id", ns."removed" DESC, ns."createdAt"
ON CONFLICT ("subscriberId", "listId") DO NOTHING;
