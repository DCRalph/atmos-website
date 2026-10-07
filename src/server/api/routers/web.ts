import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  fetchInstagramProfile,
  instagramUsername,
} from "~/server/instagram-profile";
import { readPage, WebFetchError } from "~/server/web";

/**
 * Reading the open web, for Will GPT. To keep what it finds, an image goes
 * through `uploads.importFromUrl`.
 */
export const webRouter = createTRPCRouter({
  /** A page's title, text and image links, or what kind of file a link is. */
  read: adminProcedure
    .input(z.object({ url: z.url() }))
    .query(({ input }) => readPage(input.url)),

  /**
   * Someone's public Instagram profile: name, bio, bio link and a profile
   * photo URL to import. Takes a handle or any profile link.
   */
  instagramProfile: adminProcedure
    .input(z.object({ handleOrUrl: z.string().min(1).max(500) }))
    .query(({ input }) => {
      const username = instagramUsername(input.handleOrUrl);
      if (!username) {
        throw new WebFetchError(
          "That is not an Instagram handle or profile link. Post and reel links do not say whose profile to read.",
        );
      }
      return fetchInstagramProfile(username);
    }),
});
