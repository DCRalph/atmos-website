/**
 * Reading addresses out of whatever an admin pastes or uploads: a CSV export,
 * a column from a spreadsheet, a list copied out of an email.
 */

const EMAIL = /[^\s@,;<>"'()[\]]+@[^\s@,;<>"'()[\]]+\.[^\s@,;<>"'()[\]]{2,}/g;

/** Lowercased and trimmed, the way every address is stored. */
export function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Every distinct address in the text, in the order they first appear. */
export function extractEmails(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(EMAIL)) {
    seen.add(normaliseEmail(match[0]));
  }
  return [...seen];
}
