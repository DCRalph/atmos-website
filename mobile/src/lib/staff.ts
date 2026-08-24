import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Whether this account is Atmos staff, in one place.
 *
 * Both facts are read from the queries the staff screens themselves use, and
 * both are refused server-side for everybody else — `doorProcedure` and
 * `eventOrganiserProcedure`. So this is not a second permission system that can
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
  isOrganiser: boolean;
  isStaff: boolean;
  /** False until both answers are in, so nothing staff-shaped flashes first. */
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
  const organiserEvents = api.ticketEvents.list.useQuery(
    { includeArchived: false },
    { enabled: !!user, retry: false, staleTime: 5 * 60 * 1000 },
  );

  const isDoorStaff = !!user && (myEvents.data?.length ?? 0) > 0;
  const isOrganiser = !!user && organiserEvents.isSuccess;

  // A disabled query stays `pending` forever, so signed out has to be its own
  // answer rather than something to wait on.
  const ready = !user || (!myEvents.isPending && !organiserEvents.isPending);

  return {
    isDoorStaff,
    isOrganiser,
    isStaff: isDoorStaff || isOrganiser,
    ready,
  };
}
