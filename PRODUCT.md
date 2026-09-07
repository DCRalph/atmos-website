# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Atmos administrators and event organisers manage live music content, ticketed events, sales, access, and operational communication. The Wallet debug surface is for an administrator building and sending a standalone iOS pass without touching live ticketing data.

## Product Purpose

Atmos combines a public music and events site with ticket sales and the operational tools needed to run those events. Its ticketing system issues scannable tickets, delivers them by email, and supports signed Apple Wallet passes that can stay current after event or ticket changes.

## Positioning

The live product uses the same event and ticket records across purchase, admission, administrative operations, ticket email, and updateable wallet passes. The debug workflow deliberately sits outside that system so arbitrary pass experiments cannot alter a real ticket or order.

## Operating Context

Administrators work in the web admin. Door staff and organisers may also use the mobile app, but ticket configuration and debugging happen on the web where there is room to inspect dense pass data. Wallet verification ultimately happens on a real iPhone.

## Capabilities and Constraints

- The Wallet debug surface creates standalone signed `.pkpass` files. It must not read from or write to tickets, orders, events, scans, QR secrets, or Wallet registrations.
- Each standalone pass has its own editable serial number and barcode payload.
- Every customizable PassKit aspect should be available, initialized from the real pass's current values. Advanced values may use structured or raw controls where friendly controls do not cover the underlying schema.
- Sending uses a basic fixed email template. The recipient can be chosen, but the email presentation is not customizable.
- Existing production pass behavior includes QR admission payloads, ticket and event fields, pass artwork, colors, relevant and expiration dates, and optional Wallet web-service updates.
- Debug functionality is admin-only and must make real side effects, validation failures, and the selected environment clear before sending.

## Brand Commitments

The product is Atmos. Admin surfaces use concise language and a dense dark interface. The background remains true black, primary text white, and decoration restrained. Avoid ornamental cards, pills, excess copy, and continuous animations.

## Evidence on Hand

- Apple Wallet pass builder: `src/server/wallet/apple.ts`
- Shared pass theme and artwork rules: `src/lib/ticketing/pass-theme.ts` and `src/server/wallet/pass-images.ts`
- Existing pass preview control: `src/components/admin/ticketing/pass-theme-field.tsx`
- Ticket email sender and templates: `src/server/ticketing/email/send.ts` and `src/server/ticketing/email/templates.ts`
- Admin navigation and shell: `src/components/admin/admin-navigation.ts` and `src/app/(admin)/layout.tsx`
- Wallet update behavior and production smoke test: `docs/ticketing/APPLE-WALLET.md`

## Product Principles

- Use the same signing and artwork machinery as customer passes without linking debug data to live ticketing records.
- Show safe defaults before exposing expert overrides.
- Keep irreversible or external actions explicit and reviewable.
- Prefer one complete workflow over disconnected utility screens.
- Preserve accessibility and full-text fallbacks when artwork carries visible information.

## Accessibility & Inclusion

Custom pass content must preserve meaningful text fields and readable contrast even when visual artwork changes. Controls must be keyboard-operable and must not rely on color alone to communicate state or validation.
