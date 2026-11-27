import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Whether this account is Atmos staff, in one place.
 *
 * Access is read from the queries the staff screens themselves use, including
 * the admin-only task access check. Each is refused server-side for everybody
 * else. So this is not a second permission system that can
 * drift from the real one; it is a read of the same answer, used to decide what
 * to draw.
 *
 * Nothing about Tap to Pay, door mode or organiser tooling renders for an
 * account this says no to. That is a product decision rather than a security
 * one: the server would refuse the calls regardless, but a punter should not be
 * able to tell the internal tooling exists.
 */
export function useStaff(): {
  /** Rostered on a door tonight, or an admin or organiser, who get every event. */
  isDoorStaff: boolean;
  /** Holds EVENT_ORGANISER: every event, gig rooms and team notifications. */
  isOrganiser: boolean;
  /**
   * Can read event analytics: organisers, plus people outside the team granted
   * one event's sales on the web admin. Those see analytics for that event and
   * nothing else in the app, so this is not part of `isStaff`.
   */
  canViewSales: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  /** False until the access checks finish, so nothing staff-shaped flashes first. */
  ready: boolean;
} {
  const { user } = useAuth();

  // A refusal is the normal answer for a punter, not an error worth retrying
  // three times.
  const myEvents = api.door.myEvents.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  // `ticketEvents.list` no longer says "organiser": it also answers somebody
  // granted a single event's sales. The permission itself does.
  const me = api.user.me.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const adminAccess = api.tasks.access.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = !!user && adminAccess.isSuccess;
  const isDoorStaff = !!user && (myEvents.data?.length ?? 0) > 0;
  const isOrganiser =
    !!user && !!me.data?.effectivePermissions.includes("EVENT_ORGANISER");
  const canViewSales = !!user && !!me.data?.canViewEvents;

  // A disabled query stays `pending` forever, so signed out has to be its own
  // answer rather than something to wait on.
  const ready =
    !user ||
    (!myEvents.isPending &&
      !me.isPending &&
      !adminAccess.isPending);

  return {
    isDoorStaff,
    isOrganiser,
    canViewSales,
    isAdmin,
    isStaff: isDoorStaff || isOrganiser,
    ready,
  };
}
