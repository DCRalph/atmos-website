import { useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

import {
  activityPayload,
  runSheetActivity,
  type ActivityGig,
  type ActivityPayload,
} from "~/lib/run-sheet/live-activity";

import { api } from "@/lib/api";
import { useStaff } from "@/lib/staff";

/**
 * Tonight's run sheet, on the lock screen.
 *
 * What is on, a bar through it and a second fainter one through the whole
 * night, how long until the next thing and what that thing is. From an hour
 * before the first item it is a countdown to it instead.
 *
 * The division of labour is the whole design:
 *
 *   * **The countdown and the bars are the widget's own.** SwiftUI draws all
 *     three from pairs of dates, so a locked handset stays right second to
 *     second with nothing of ours running. Neither this file nor the server
 *     ticks anything.
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
 * What the widget should be showing, ready to send.
 *
 * The JSON comes back rather than being sent from here because the caller
 * compares it with what it sent last: a state that has not changed is a wake-up
 * of the native side for nothing, thirty seconds apart, all night.
 */
function payloadFor(gig: ActivityGig, at: Date): ActivityPayload {
  return activityPayload(gig, runSheetActivity(gig, at));
}

/** Hand it over. Failure is not the caller's problem. */
function send(json: string): void {
  void native?.apply(json).catch(() => {
    // A lock screen is a courtesy on top of the run sheet screen. If iOS will
    // not have it, the night carries on.
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

/**
 * Mounted once, from the providers. Renders nothing.
 *
 * It owns the lock screen for the life of the app, which is why the test below
 * is driven from here as well rather than from the screen with the button on
 * it: a screen unmounts when somebody navigates away, and a test that stops
 * ticking halfway through is worse than no test.
 */
export function useRunSheetLiveActivity(): void {
  // Staff only, and read from the same queries the staff screens already run,
  // so a punter's handset does not poll for a run sheet the server would refuse
  // it anyway.
  const { isStaff } = useStaff();
  const enabled = isStaff && isLiveActivitySupported();
  const testing = useSyncExternalStore(subscribeTesting, isTesting, isTesting);

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

  // The test, while one is running. Its own effect, because it and the run
  // sheet below are two owners of one lock screen and only one may hold it.
  useEffect(() => {
    if (!enabled || !testing) return;
    const from = testStartedAt;
    if (!from) return;

    const fake = testGig(from);
    const tick = () => {
      const payload = payloadFor(fake, new Date());
      send(JSON.stringify(payload));
      // The fake night is over. Handing the lock screen back is part of the
      // test: the real run sheet should reappear if there is one on.
      if (!payload.active) setTesting(false);
    };

    tick();
    const timer = setInterval(tick, TEST_TICK_MS);
    return () => clearInterval(timer);
  }, [enabled, testing]);

  // The real run sheet, whenever a test does not have the lock screen.
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

    // Clearing `applied` rather than remembering it is what makes the real run
    // sheet go back up in full the moment the test finishes, instead of being
    // skipped as unchanged.
    if (testing) {
      applied.current = null;
      return;
    }

    const sync = () => {
      // `null` is "no run sheet"; `undefined` is "not asked yet", and a query
      // that has not come back is not a reason to clear a lock screen. Without
      // this, relaunching the app in the middle of a night would take the
      // activity down and put it straight back a moment later.
      if (gig === undefined) return;

      const json = gig ? JSON.stringify(payloadFor(gig, new Date())) : null;
      if (json === applied.current) return;
      applied.current = json;

      // Nothing on at all. Anything still up belongs to a night that is over.
      if (json) send(json);
      else endRunSheetActivity();
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
  }, [enabled, testing, gig]);
}

/* -- Testing it ---------------------------------------------------------- */

/**
 * Whether a test has the lock screen, and when it started.
 *
 * Module-level and published as a store, because the button that starts it and
 * the hook that drives it are in different trees and neither owns the answer.
 * One activity, one owner at a time.
 */
let testActive = false;
let testStartedAt: Date | null = null;
const testListeners = new Set<() => void>();

function setTesting(next: boolean): void {
  if (testActive === next) return;
  testActive = next;
  for (const listener of testListeners) listener();
}

function subscribeTesting(listener: () => void): () => void {
  testListeners.add(listener);
  return () => testListeners.delete(listener);
}

function isTesting(): boolean {
  return testActive;
}

/** How often the test re-derives. Only names need it; the bars are the OS's. */
const TEST_TICK_MS = 2_000;

/**
 * A night in four minutes.
 *
 * Every state the lock screen has, in the order it has them, fast enough to
 * watch: three quarters of a minute of countdown before anything starts, an
 * item with a typed end, one that runs until the next begins, a changeover, and
 * a last item with nothing after it. Then it takes itself down.
 *
 * Relative to when the button was pressed rather than fixed times, so it works
 * at any hour and needs no gig, no roster and no run sheet typed in.
 */
function testGig(from: Date): ActivityGig {
  const at = (seconds: number) => new Date(from.getTime() + seconds * 1000);
  return {
    id: "run-sheet-test",
    title: "Live activity test",
    rows: [
      // A typed end, so the gap before the next item is real and the bar has
      // somewhere to stop.
      { name: "Doors", startsAt: at(45), endsAt: at(100) },
      // No end: runs until Nova is on, changeover included.
      { name: "Kessler", startsAt: at(105), endsAt: null },
      { name: "Nova b2b Juno", startsAt: at(165), endsAt: null },
      { name: "Curfew", startsAt: at(225), endsAt: at(240) },
    ],
  };
}

/**
 * Put a fake night on the lock screen, to see that any of this works.
 *
 * It exercises everything the widget draws — both bars, the countdown, each
 * phase and the roll from one item to the next — without a gig or a run sheet
 * to set up first.
 *
 * What it cannot exercise is the silent push. The test is ticked by a timer in
 * the app, and iOS suspends those once the app is in the background, so a test
 * watched from a locked handset shows the bars and the countdown moving but
 * holds its names until you come back to the app. That difference *is* the
 * reason the real thing is pushed from the server rather than ticked here.
 */
export function useLiveActivityTest(): {
  supported: boolean;
  running: boolean;
  start: () => void;
  stop: () => void;
} {
  return {
    supported: isLiveActivitySupported(),
    running: useSyncExternalStore(subscribeTesting, isTesting, isTesting),
    start: () => {
      testStartedAt = new Date();
      setTesting(true);
    },
    stop: () => {
      setTesting(false);
      endRunSheetActivity();
    },
  };
}
