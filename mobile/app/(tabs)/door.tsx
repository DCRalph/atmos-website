import { Redirect } from "expo-router";

/**
 * The Door tab is a doorway, not a screen.
 *
 * Door mode runs full-screen outside the tabs — at a door you want the whole
 * display and no tab bar to fat-finger into the gig list mid-queue.
 */
export default function DoorTab() {
  return <Redirect href="/(door)" />;
}
