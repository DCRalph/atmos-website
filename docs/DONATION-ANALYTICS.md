# Donation analytics

Donation tracking uses the site's existing PostHog project and `/ph` proxy.
There are no new credentials or database migrations. Data starts collecting
when this code is deployed; it does not backfill past visits.

## Reports to create in PostHog

- **Visitors and visits:** count unique users of `donation_page_viewed` for
  people, and unique `page_view_id` values for visits. Filter by `gig_id` to
  inspect one gig. A confirmed Stripe return records a thank you rather than
  another visit to the donation form.
- **Conversion and drop-off:** create a funnel with `donation_page_viewed`,
  `donation_checkout_started`, `donation_payment_submitted`, then
  `donation_completed`. Hold `gig_id` and `page_view_id` constant and use a
  one-day conversion window. PostHog's time-to-convert view shows how long
  donors take. Amount selection is optional because the recommended amount
  starts selected.
- **Time on page:** sum `visible_seconds_delta` from
  `donation_page_engagement` **per `page_view_id`**, then average or take the
  median of those visit totals. Include visits with a `donation_page_viewed`
  event when measuring the donation form. Do not average cumulative
  `visible_seconds` across heartbeat events; longer visits emit more events.
- **Traffic quality:** break the funnel down by `utm_source`, `utm_medium`,
  or `utm_campaign`. The browser events also carry PostHog's usual referrer,
  device, browser, and session properties. Use first-step breakdowns when
  comparing mobile and desktop conversion.
- **Amounts and revenue:** use `donation_completed` with `amount_choice`
  (`recommended`, `suggested`, `custom`), `amount_cents`, `revenue` in dollars,
  and `currency`. Count unique `payment_id` for completed donations. These
  are gross successful payments; refunds remain in the Donations admin totals.
- **Payment friction:** break `donation_payment_failed` down by `stage` and
  `error_code`. Compare `donation_wallets_available`,
  `donation_wallet_cancelled`, and `payment_method` on checkout starts with
  completed donations. `donation_amount_revisited` shows people returning
  from the card form to change their amount.

Tagged link example:

```text
/gigs/night/donate?utm_source=instagram&utm_medium=social&utm_campaign=night_launch
```

## Event behavior

Every custom browser event includes `gig_id`, `gig_title`, `page_view_id`,
`page_path`, `currency`, campaign tags present on the URL, `elapsed_seconds`,
and `visible_seconds`.

`donation_page_engagement` sends a heartbeat every 15 seconds and a final
delta on tab hiding, page exit, or client-side navigation. Hidden time does
not count. Visibility measures time with the page open in a visible tab,
including time spent reading without interacting. A browser or device being
force-closed can lose the time since the last heartbeat. Its `stage` and
`converted` describe the browser's last known progress.

`donation_thank_you_viewed` describes the browser experience.
`donation_payment_processing` means Stripe has not confirmed success yet.
Neither is the conversion event.

`donation_completed` comes only from the signed Stripe success webhook,
after the donation is recorded. Anonymous visitor/session IDs, the original
page view, amount choice, and campaign tags travel through bounded Stripe
metadata so completion can join the funnel even if the tab has closed.
The event uses Stripe's actual amount, the recorded payment time, and a
deterministic UUID for webhook retries. PostHog's UUID deduplication is
eventual; unique `payment_id` is the appropriate count while retries settle.

Conversion delivery runs after the webhook response, has a three-second
timeout and one retry, and cannot fail a payment. Failed analytics delivery
is logged; it has no durable retry queue. The donation ledger remains intact.

Receipt email, donor name, card fields, and raw error messages are excluded
from these events. Stripe client secrets are removed from return URLs and
PostHog URL properties. Campaign tags are limited to 100 characters each.
Opting out of PostHog also omits attribution metadata and its server
conversion event. Browser blocking and opt-outs mean tracked conversions
can be fewer than donations in the payment ledger.
