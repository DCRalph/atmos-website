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
 * What kind of thing a campaign is. Picked from a list rather than typed, so
 * the analytics can say which kind sells. It travels in the link as
 * `utm_medium` and every order copies it, so the type survives the campaign
 * row being deleted.
 */
export const CAMPAIGN_TYPES = [
  "story",
  "post",
  "reel",
  "paid",
  "email",
  "poster",
  "bio",
  "share",
  "other",
] as const;

export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  story: "Story",
  post: "Post",
  reel: "Reel / video",
  paid: "Paid ad",
  email: "Newsletter",
  poster: "Poster / QR",
  bio: "Bio link",
  share: "Repost / share",
  other: "Other",
};

/** Where a campaign runs. Travels as `utm_source`. */
export const CAMPAIGN_SOURCES = [
  "instagram",
  "facebook",
  "tiktok",
  "x",
  "youtube",
  "email",
  "print",
  "website",
  "partner",
  "other",
] as const;

export type CampaignSource = (typeof CAMPAIGN_SOURCES)[number];

export const CAMPAIGN_SOURCE_LABELS: Record<CampaignSource, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
  email: "Email",
  print: "Print",
  website: "Website",
  partner: "Partner",
  other: "Other",
};

/**
 * Tags that stand for a listed source but aren't spelled like it: links made
 * by hand before the list existed, and the hosts referrals resolve to.
 */
const SOURCE_ALIASES: Record<string, CampaignSource> = {
  ig: "instagram",
  insta: "instagram",
  fb: "facebook",
  tt: "tiktok",
  twitter: "x",
  newsletter: "email",
  mail: "email",
  poster: "print",
  flyer: "print",
  qr: "print",
};

function isOneOf<const T extends string>(
  list: readonly T[],
  value: string | null | undefined,
): value is T {
  return value != null && (list as readonly string[]).includes(value);
}

/**
 * The type a `utm_medium` stands for: itself when it's on the list, else
 * `other`. Hand-written links and the automatic `referral` land in `other`.
 */
export function campaignTypeOf(
  medium: string | null | undefined,
): CampaignType {
  return isOneOf(CAMPAIGN_TYPES, medium) ? medium : "other";
}

/** The source a `utm_source` stands for, through the aliases. */
export function campaignSourceOf(
  source: string | null | undefined,
): CampaignSource {
  if (isOneOf(CAMPAIGN_SOURCES, source)) return source;
  return (source ? SOURCE_ALIASES[source] : undefined) ?? "other";
}

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
