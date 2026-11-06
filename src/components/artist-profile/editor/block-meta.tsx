import {
  AudioLines,
  CalendarClock,
  CirclePlay,
  Code,
  Heading,
  History,
  Image as ImageIcon,
  Images,
  Link as LinkIcon,
  ListMusic,
  type LucideIcon,
  Minus,
  MoveVertical,
  Music,
  Share2,
  Text,
  TriangleAlert,
} from "lucide-react";
import type { ArtistBlockTypeName } from "~/lib/artist-blocks";

/** The editor's icon for each block type. */
export const BLOCK_ICONS: Record<ArtistBlockTypeName, LucideIcon> = {
  HEADING: Heading,
  RICH_TEXT: Text,
  IMAGE: ImageIcon,
  GALLERY: Images,
  SOUNDCLOUD_TRACK: AudioLines,
  SOUNDCLOUD_PLAYLIST: ListMusic,
  SPOTIFY_EMBED: Music,
  YOUTUBE_VIDEO: CirclePlay,
  SOCIAL_LINKS: Share2,
  LINK_LIST: LinkIcon,
  GIG_LIST: CalendarClock,
  PAST_GIGS: History,
  CONTENT_LIST: TriangleAlert,
  DIVIDER: Minus,
  SPACER: MoveVertical,
  CUSTOM_EMBED: Code,
};

/**
 * What a block in the editor says while it has nothing to show. Visitors
 * never see it: the public page leaves the block out until it does.
 */
export const EMPTY_HINTS: Record<ArtistBlockTypeName, string> = {
  HEADING: "Type a heading",
  RICH_TEXT: "Write something",
  IMAGE: "Add a photo",
  GALLERY: "Add photos",
  SOUNDCLOUD_TRACK: "Paste a SoundCloud link",
  SOUNDCLOUD_PLAYLIST: "Paste a SoundCloud link",
  SPOTIFY_EMBED: "Paste a Spotify link",
  YOUTUBE_VIDEO: "Paste a YouTube link",
  SOCIAL_LINKS: "Add your socials to show them here",
  LINK_LIST: "Add a link",
  GIG_LIST: "Shows when you have sets coming up",
  PAST_GIGS: "Shows once you've played an Atmos set",
  CONTENT_LIST: "This block can't be shown any more. Remove it.",
  DIVIDER: "",
  SPACER: "",
  CUSTOM_EMBED: "Paste a link to embed",
};
