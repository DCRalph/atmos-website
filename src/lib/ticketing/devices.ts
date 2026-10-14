/**
 * What an order was bought on, in words. `TicketOrder.device` is `mobile`,
 * `tablet` or `desktop`; `os` is `iOS`, `Android`, `macOS`...
 *
 * Shared by the analytics device cards and the order dialog so both say the
 * same thing.
 */

const DEVICE_NOUN: Record<string, string> = {
  mobile: "phone",
  tablet: "tablet",
  desktop: "computer",
};

const capitalise = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1);

/** The kind of device alone: "Phone", "Tablet", "Computer". */
export const deviceKindLabel = (device: string) =>
  capitalise(DEVICE_NOUN[device] ?? device);

/** Device with its OS when known: "iOS phone", "Windows computer". */
export const deviceLabel = (device: string, os: string | null) =>
  os && os !== "Other"
    ? `${os} ${DEVICE_NOUN[device] ?? device}`
    : deviceKindLabel(device);
