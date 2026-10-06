/**
 * The poster an event shows: its own when one was uploaded, otherwise the
 * linked gig's. Never a TBA gig's, whose poster id opens the unblurred poster.
 */
export function eventPosterId(event: {
  posterFileUploadId: string | null;
  gig?: { posterFileUploadId: string | null; isTba: boolean } | null;
}): string | null {
  if (event.posterFileUploadId) return event.posterFileUploadId;
  if (!event.gig || event.gig.isTba) return null;
  return event.gig.posterFileUploadId;
}
