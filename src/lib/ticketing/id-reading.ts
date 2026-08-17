import { z } from "zod";

import { ID_DOCUMENT_TYPES } from "~/lib/ticketing/id-documents";

/**
 * The details off an identity document, however they were obtained.
 *
 * **This is the seam an ID SDK plugs into.** Nothing in this codebase reads a
 * document: no OCR, no template matching, no barcode parsing. Something else
 * does that — today a staffer reading the card and typing, tomorrow a
 * commercial SDK on the handset — and whichever it is, it produces this shape
 * and everything downstream carries on unchanged.
 *
 * Keeping the shape this plain is the point. `checkIdentity` does not know or
 * care where a birthday came from, so swapping the reader is a change to one
 * screen rather than a change to the age rules, the ban list, the retention
 * clock or the audit log.
 *
 * When an SDK is chosen, add the fields it returns that we do not yet have —
 * a portrait it cropped, an authenticity verdict, a confidence score — and let
 * `checkIdentity` act on them. See `docs/ticketing/ID-CHECKS.md`.
 */
export const idReadingSchema = z.object({
  documentType: z.enum(ID_DOCUMENT_TYPES),
  /**
   * The number printed on the card.
   *
   * Optional, but it is what a patron record is keyed on when it is there —
   * exact, stable, and the same on every visit. Without one the record falls
   * back to the name and birthday together, which is weaker: it will miss
   * somebody whose name is entered differently next time.
   */
  documentNumber: z.string().trim().max(40).optional(),
  fullName: z.string().trim().min(1).max(120),
  dateOfBirth: z.iso.date(),
  expiry: z.iso.date().optional(),
});

export type IdReadingInput = z.infer<typeof idReadingSchema>;
