import { formatEventDateLong } from "~/lib/ticketing/dates";
import {
  emailShell,
  escapeHtml,
  intro,
  pillButton,
  row,
  type RenderedEmail,
} from "./layout";

/**
 * The "photos are up" email, sent to everybody who signed up on a gig page.
 * One template for every recipient.
 */
export function renderPhotosEmail(gig: {
  title: string;
  venue: string;
  startsAt: Date;
  /** Absolute image URLs. The first four are shown, two by two. */
  thumbnails: string[];
  galleryUrl: string;
}): RenderedEmail {
  const title = escapeHtml(gig.title);
  const when = `${formatEventDateLong(gig.startsAt)}, ${gig.venue}`;
  const thumbs = gig.thumbnails
    .slice(0, 4)
    .map(
      (url) =>
        `<td width="50%" style="padding:2px;"><a href="${escapeHtml(gig.galleryUrl)}"><img src="${escapeHtml(url)}" width="296" alt="" style="display:block;width:100%;height:auto;border:0;"></a></td>`,
    );
  const rows = [thumbs.slice(0, 2), thumbs.slice(2, 4)]
    .filter((thumbRow) => thumbRow.length)
    .map((thumbRow) => `<tr>${thumbRow.join("")}</tr>`)
    .join("");

  const subject = `The photos from ${gig.title} are up`;
  const body = [
    intro("The photos are up", `${title}<br>${escapeHtml(when)}`),
    rows
      ? row(
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
        )
      : "",
    row(pillButton(gig.galleryUrl, "See the photos"), 8),
  ].join("\n");

  const text = [
    "The photos are up",
    "",
    gig.title,
    when,
    "",
    `See them: ${gig.galleryUrl}`,
    "",
    `You asked to hear when the photos from ${gig.title} were up.`,
  ].join("\n");

  return {
    subject,
    html: emailShell({
      title: subject,
      body,
      footer: `You asked to hear when the photos from ${title} were up.`,
    }),
    text,
  };
}
