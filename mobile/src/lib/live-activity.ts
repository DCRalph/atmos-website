import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

import {
  activityPayload,
  runSheetActivity,
  type ActivityPayload,
} from "~/lib/run-sheet/live-activity";

import { api } from "@/lib/api";
import { useStaff } from "@/lib/staff";

/**
 * Tonight's run sheet, on the lock screen.
 *
 * What is on, how long there is until the next thing, and what that thing is,
 * with a bar running through the current item. From an hour before the first
 * item it is a countdown to it instead.
 *
 * The division of labour is the whole design:
 *
 *   * **The countdown and the bar are the widget's own.** SwiftUI draws both
 *     from a pair of dates, so a locked handset stays right second to second
 *     with nothing of ours running. Neither this file nor the server ticks
 *     anything.
 *   * **This starts it.** iOS refuses to let an app put a Live Activity up
 *     from the background, so it goes up when somebody opens the app — which
 *     on a night is what tapping the cue notification does.
 *   * **The server moves it on.** `pokeLiveActivities` in the website's run
 *     sheet sweep sends a silent push on the minute an item changes, carrying
 *     the new state, and `RunSheetActivitySubscriber` applies it without waking
 *     any of this.
 *
 * Both ends derive from `~/lib/run-sheet/live-activity`, so the state the app
 * puts up and the state the push replaces it with cannot disagree.
 *
 * The native side is `modules/run-sheet-activity`, looked up by name so nothing
 * here reaches into the native tree.
 */
type RunSheetActivityModule = {
  isSupported: () => boolean;
  apply: (payload: string) => Promise<boolean>;
  endAll: () => Promise<void>;
};

const native =
  requireOptionalNativeModule<RunSheetActivityModule>("RunSheetActivity");

/**
 * Whether this handset can show one: iOS 16.2 or later, and not switched off
 * in Settings. False everywhere else, including Android, where the run sheet
 * screen is the whole feature.
 */
export function isLiveActivitySupported(): boolean {
  try {
    return native?.isSupported() ?? false;
  } catch {
    return false;
  }
}

/** Take it down. On sign-out, because the night stops being ours. */
export function endRunSheetActivity(): void {
  void native?.endAll().catch(() => {
    // Nothing to do about a lock screen that will not clear, and a sign-out
    // must not fail over one.
  });
}

/**
 * How often the app re-derives while it is in front.
 *
 * Only the *names* need this — the widget's own clock covers everything else —
 * so it exists to catch the moment an item changes while somebody is holding
 * the phone, and to right a lock screen whose push iOS decided not to deliver.
 */
const TICK_MS = 30_000;

/** Mounted once, from the providers. Renders nothing. */
export function useRunSheetLiveActivity(): void {
  // Staff only, and read from the same queries the staff screens already run,
  // so a punter's handset does not poll for a run sheet the server would refuse
  // it anyway.
  const { isStaff } = useStaff();
  const enabled = isStaff && isLiveActivitySupported();

  const live = api.runSheet.live.useQuery(undefined, {
    enabled,
    retry: false,
    // The rows, not the state: what is on is worked out from them locally on
    // every tick, so this only has to keep up with an organiser editing the
    // run sheet rather than with the night itself.
    refetchInterval: 5 * 60_000,
  });

  // What was last sent, so an unchanged state is not re-applied every tick.
  const applied = useRef<string | null>(null);
  const gig = live.data;

  useEffect(() => {
    // Signed out, no longer staff, or a handset that cannot show one. Either
    // way tonight is no longer this person's to have on their lock screen —
    // and doing it here rather than in the sign-out button covers deleting the
    // account too.
    if (!enabled) {
      if (applied.current !== null) {
        applied.current = null;
        endRunSheetActivity();
      }
      return;
    }

    const sync = () => {
      // `null` is "no run sheet"; `undefined` is "not asked yet", and a query
      // that has not come back is not a reason to clear a lock screen. Without
      // this, relaunching the app in the middle of a night would take the
      // activity down and put it straight back a moment later.
      if (gig === undefined) return;

      const payload: ActivityPayload | null = gig
        ? activityPayload(gig, runSheetActivity(gig, new Date()))
        : null;

      const json = payload ? JSON.stringify(payload) : null;
      if (json === applied.current) return;
      applied.current = json;

      // Nothing on at all. Anything still up belongs to a night that is over.
      if (!json) {
        endRunSheetActivity();
        return;
      }
      void native?.apply(json).catch(() => {
        // A lock screen is a courtesy on top of the run sheet screen. If iOS
        // will not have it, the night carries on.
      });
    };

    sync();
    const timer = setInterval(sync, TICK_MS);
    // Coming back to the app is the other moment worth re-deriving at: it is
    // when a missed push is noticed and put right.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [enabled, gig]);
}
