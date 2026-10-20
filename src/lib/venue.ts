/** A Google Maps search for a venue, by address when it has one. */
export const venueMapsUrl = (venue: { name: string; address: string | null }) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    venue.address ? `${venue.name}, ${venue.address}` : venue.name,
  )}`;
