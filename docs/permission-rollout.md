# Permission rollout

The application uses explicit `EVENT_ORGANISER`, `CREATOR`, and `ADMIN`
permissions. Door access is scoped only by `TicketEventStaff`; there is no
global door permission.

## Release 1: assign permissions

1. Deploy the additive permission migration and this application release.
2. Sign in with an existing legacy admin account.
3. Open **Admin → Users** and assign the required explicit permissions.
4. Assign `ADMIN` to the intended administrator last. The first explicit
   `ADMIN` assignment is the cutover switch: it records a permanent cutover
   marker, and legacy roles are ignored by every authorization check from then
   on.
5. Verify Admin, Organiser, Creator, and event-assigned door accounts.

No legacy roles are copied. Existing creator-profile links and
`TicketEventStaff` rows remain intact, but they do not create global
permissions.

## Release 2: remove rollback data

After the cutover has been verified in production:

1. Confirm `user_permission_assignment` contains at least one `ADMIN` row.
2. Remove `legacyRoles`, `UserRoleAssignment`, `UserRole`, the legacy fallback
   in `permissions.ts`, `invite.role`, and the three legacy role activity
   values.
3. Generate a Prisma migration that drops `user_role_assignment` and the
   `UserRole` enum.

Do not perform release 2 before the explicit admin check succeeds; otherwise
the administration UI will be inaccessible.
