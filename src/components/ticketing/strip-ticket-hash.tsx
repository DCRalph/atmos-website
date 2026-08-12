import { TICKET_TOKEN_PREFIX } from "~/lib/ticketing/qr-token";

/**
 * Takes a ticket token out of the address bar the instant the page is parsed.
 *
 * A ticket QR encodes the event page with the token in the fragment, so a
 * phone camera opens an ad for the event and a scanner reads a credential off
 * the same code. The fragment never reaches the server, but it does sit in the
 * URL bar of whoever scanned it — over their shoulder on a bus, in a
 * screenshot, in synced browser history, in whatever they paste to a friend
 * who then holds a working ticket. So it goes, and it goes early.
 *
 * This is a blocking inline script rather than an effect on the event page
 * because "early" is the whole point: it runs while the HTML is still being
 * parsed, before React hydrates and before analytics or any other third-party
 * script gets a turn to read `location.hash`. An effect would leave the token
 * sitting there for the length of a hydration, readable by anything already
 * running.
 *
 * It is mounted app-wide, not just on `/events/[slug]`: a stray ticket
 * fragment on any route is one we would rather drop than keep.
 */

const MARKER = JSON.stringify(`#${TICKET_TOKEN_PREFIX}.`);

// `replaceState` rather than `pushState` so the token is not one Back press
// away, and the path and query are preserved untouched — a private event's
// `?k=` key has to survive this.
const SCRIPT = `(function(){try{
if(window.location.hash.indexOf(${MARKER})!==0)return;
window.history.replaceState(window.history.state,"",window.location.pathname+window.location.search);
}catch(e){}})();`;

export function StripTicketHash() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
