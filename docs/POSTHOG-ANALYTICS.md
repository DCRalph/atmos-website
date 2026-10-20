# ATMOS PostHog analytics

Project: [atmosmedia.co.nz, 309967](https://us.posthog.com/project/309967/home).
Reporting timezone: `Pacific/Auckland`. Default report period: 30 days.
Configured through the API on 20 October 2026.

## Dashboards

- [Website overview](https://us.posthog.com/project/309967/dashboard/2232881):
  public visitors, sessions, views, popular pages, referring domains, devices,
  campaign traffic, site sections, and the shared donation funnel.
- [Donation analytics](https://us.posthog.com/project/309967/dashboard/2228900):
  visitors and distinct visits, conversion and time to convert, visible time,
  traffic sources and devices, unique payments and gross NZD revenue, gig
  performance, wallet availability, and payment failures.
- [Site actions and friction](https://us.posthog.com/project/309967/dashboard/2232882):
  enquiry submissions, merch cart intent, ticket-event page interest, key
  actions, rage-click hotspots, and a diagnostic showing traffic by host.

These dashboards contain 24 saved reports. The donation funnel is shared
between Website overview and Donation analytics. Six existing donation
reports were corrected in place; their links remain valid.

## Traffic filters

Public-site reports include browser events from `atmosmedia.co.nz` and
`www.atmosmedia.co.nz`. Preview deployments and local development are excluded.
Admin, dashboard, organiser, door, screen, development-preview, authentication,
API, and private ticket/receipt/token routes are excluded from public traffic.
Reports also apply the project's internal/test filters. The host diagnostic
deliberately includes excluded environments so their volume can be checked.

Stripe completion events do not have browser host or device properties.
Donation funnels match the same `page_view_id` across steps, beginning with
a production browser visit. Revenue reports link completions back to production
visits and deduplicate by `payment_id`. Revenue and amount reports require both
the visit and payment to be in the selected period. The gig report also limits
conversion to one day after the visit.

## Metric definitions

- Visitors are unique anonymous browser identities. Browser changes,
  cleared storage, blocking, and opting out affect these counts.
- Donation visits count distinct `page_view_id` values. A Stripe return to
  the thank-you screen does not create another form visit.
- The main donation funnel counts visits, with a one-day conversion window.
  Amount selection is optional because a recommended amount can start selected.
- Visible time sums `visible_seconds_delta` per visit, then computes an
  average and median. Visits with no recorded engagement count as zero.
  Hidden time pauses; idle reading and the thank-you screen are included.
- Successful donations count unique Stripe `payment_id` values. Revenue is
  gross NZD and does not subtract refunds. The payment ledger remains the
  financial source of truth.
- Payment failure reports count attempts and show both `stage` and
  `error_code`. An empty table means no matching failure events were recorded.
- Contact conversion requires `contact_form_submitted`; an email-link click
  is tracked separately. Merch cart adds indicate intent to buy.

## Coverage limits

Successful ticket purchases and Shopify purchase completion are not currently
captured as PostHog events. The site-actions dashboard labels ticket interest
as page views and merch activity as add-to-cart intent. Those reports must not
be interpreted as completed purchases or sales conversion.

Donation-specific events only cover visits after donation tracking was deployed.
Earlier generic donation-page views do not have the same engagement or funnel
properties and are not backfilled into the new funnel.

The local `NEXT_PUBLIC_POSTHOG_KEY` did not match this project's token during
setup. Production events are arriving in this project. Check the intended
local/deployment configuration before using development data to validate it.

## Verification and administration

All 24 report queries were executed against live data before saving. Saved
dashboard membership, visit matching, SQL definitions, and the reporting
timezone were checked through the API. Critical audience, funnel, visible-time,
revenue, and gig reports were executed again after saving.

PostHog occasionally returned `503 clickhouse_at_capacity` for concurrent
queries. Sequential validation succeeded. Query these reports in small batches
and retry capacity errors after a delay.

Administration can use `POSTHOG_PERSONAL_API_KEY` from the ignored local env
files. Read it through the environment loader and pass it only in the API
authorization header. Do not print it, save it in report definitions, or
commit it. Event capture continues to use the existing public project key.
