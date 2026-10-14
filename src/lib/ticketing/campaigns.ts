/**
 * Campaign links: the tags a link carries, and the link itself. Shared by the
 * form's live preview and the server, so what you copy is what gets saved.
 */

export type CampaignTags = {
  source: string;
  medium: string | null;
  name: string;
  content: string | null;
};

/**
 * One way to write a tag, so "Instagram" and "instagram " never split one
 * campaign into two rows: lowercase, dashes for spaces, nothing a URL mangles.
 */
export function normaliseTag(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 64);
}

/**
 * The link to hand out: the destination with the tags added. A path is on
 * `siteUrl`; an absolute URL keeps its own host and any query it already had.
 */
export function campaignUrl(
  siteUrl: string,
  destination: string,
  tags: CampaignTags,
): string {
  const url = new URL(destination || "/", siteUrl);
  url.searchParams.set("utm_source", tags.source);
  if (tags.medium) url.searchParams.set("utm_medium", tags.medium);
  url.searchParams.set("utm_campaign", tags.name);
  if (tags.content) url.searchParams.set("utm_content", tags.content);
  return url.toString();
}
