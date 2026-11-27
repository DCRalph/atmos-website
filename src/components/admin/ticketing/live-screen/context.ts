"use client";

import { createContext, useContext } from "react";

import { type RouterOutputs } from "~/trpc/react";

/** What the person looking at the screen may do from it. */
export type LiveAccess = RouterOutputs["ticketAnalytics"]["liveAccess"];

/** The event a dialog is about, and what its viewer may do there. */
export type LiveDialogProps = {
  eventId: string;
  timezone: string;
  access: LiveAccess;
};

/**
 * The event a live screen is showing and what its viewer may do, for the
 * dialogs its rows open. Null where the views are drawn without a screen
 * around them, and then nothing opens.
 */
const LiveContext = createContext<LiveDialogProps | null>(null);

export const LiveProvider = LiveContext.Provider;
export const useLive = () => useContext(LiveContext);
