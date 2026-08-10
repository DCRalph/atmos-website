/**
 * The single place every upload constraint is defined.
 *
 * To accept files somewhere new: add a preset here, then use
 * `useUpload("yourPreset")` (or one of the components in
 * `~/components/uploads`) at the call site. Nothing else needs to change —
 * validation, resizing, format conversion, S3 keys, ACL and the `file_upload`
 * bookkeeping are all driven from this file.
 *
 * Client-safe: no `sharp`, no AWS SDK, no database imports.
 */
import { z } from "zod";
import { mb, type ImageProcessing, type UploadAccess } from "./types";

/**
 * A preset with its context schemas attached.
 *
 * `context` is what a call site sends. `resolved` is what the server has after
 * `~/server/uploads/authorize` fills in anything it had to look up (e.g. the
 * signed-in user's own profile id). `forId` and `keyPrefix` read the resolved
 * shape, so they never have to deal with optional fields.
 */
/** The context shape `forId`/`keyPrefix` see: the resolved schema when a preset
 *  declares one, otherwise the context schema itself. */
type ResolvedOutput<
  TContext extends z.ZodType,
  TResolved extends z.ZodType | undefined,
> = z.output<TResolved extends z.ZodType ? TResolved : TContext>;

type PresetDefinition<
  TContext extends z.ZodType,
  TResolved extends z.ZodType | undefined,
> = {
  label: string;
  description: string;
  access: UploadAccess;
  accept: string[];
  maxFileSize: number;
  maxFiles: number;
  maxTotalSize: number;
  for: string;
  acl: "private" | "public-read";
  image?: ImageProcessing;
  context: TContext;
  resolved?: TResolved;
  forId: (context: ResolvedOutput<TContext, TResolved>) => string;
  keyPrefix: (context: ResolvedOutput<TContext, TResolved>) => string;
};

const definePreset = <
  TContext extends z.ZodType,
  TResolved extends z.ZodType | undefined = undefined,
>(
  preset: PresetDefinition<TContext, TResolved>,
) => preset;

/** Contexts shared by more than one preset. */
const gigContext = z.object({ gigId: z.string().min(1) });
/** `profileId` is optional — omitted means "the signed-in user's own profile". */
const profileContext = z.object({ profileId: z.string().min(1).optional() });
const resolvedProfileContext = z.object({ profileId: z.string().min(1) });

/** Image types every image field should accept. */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export const uploadPresets = {
  /** Photos and videos attached to a gig's galleries. */
  gigMedia: definePreset({
    label: "Gig media",
    description: "Photos and video in a gig's featured and gallery sections.",
    access: "admin",
    accept: [...IMAGE_TYPES, "video/mp4", "video/quicktime", "video/webm"],
    maxFileSize: mb(200),
    maxFiles: 40,
    maxTotalSize: mb(1024),
    for: "gig",
    acl: "public-read",
    image: {
      maxDimension: 2048,
      format: "webp",
      quality: 80,
      maxOutputSize: mb(1),
    },
    context: gigContext,
    forId: (c) => c.gigId,
    keyPrefix: (c) => `gigs/${c.gigId}`,
  }),

  /** The single poster image shown for a gig. */
  gigPoster: definePreset({
    label: "Gig poster",
    description: "The single poster image used to represent a gig.",
    access: "admin",
    accept: IMAGE_TYPES,
    maxFileSize: mb(50),
    maxFiles: 1,
    maxTotalSize: mb(50),
    for: "gig",
    acl: "public-read",
    image: {
      maxDimension: 2048,
      format: "webp",
      quality: 82,
      maxOutputSize: mb(1),
    },
    context: gigContext,
    forId: (c) => c.gigId,
    keyPrefix: (c) => `gigs/${c.gigId}/poster`,
  }),

  /** A creator's profile photo. */
  creatorAvatar: definePreset({
    label: "Creator avatar",
    description: "Profile photo on a creator's public page.",
    access: "creator",
    accept: IMAGE_TYPES,
    maxFileSize: mb(25),
    maxFiles: 1,
    maxTotalSize: mb(25),
    for: "creator_profile_avatar",
    acl: "public-read",
    image: {
      maxDimension: 896,
      format: "webp",
      quality: 82,
      maxOutputSize: mb(0.4),
    },
    context: profileContext,
    resolved: resolvedProfileContext,
    forId: (c) => c.profileId,
    keyPrefix: (c) => `creator-profiles/${c.profileId}/avatar`,
  }),

  /** The wide header image on a creator's page. */
  creatorBanner: definePreset({
    label: "Creator banner",
    description: "Full-width header image on a creator's public page.",
    access: "creator",
    accept: IMAGE_TYPES,
    maxFileSize: mb(25),
    maxFiles: 1,
    maxTotalSize: mb(25),
    for: "creator_profile_banner",
    acl: "public-read",
    image: {
      maxDimension: 2048,
      format: "webp",
      quality: 82,
      maxOutputSize: mb(1),
    },
    context: profileContext,
    resolved: resolvedProfileContext,
    forId: (c) => c.profileId,
    keyPrefix: (c) => `creator-profiles/${c.profileId}/banner`,
  }),

  /** Background image referenced from a profile's theme tokens. */
  creatorThemeBackground: definePreset({
    label: "Creator theme background",
    description: "Background image stored in a creator profile's theme tokens.",
    access: "creator",
    accept: IMAGE_TYPES,
    maxFileSize: mb(25),
    maxFiles: 1,
    maxTotalSize: mb(25),
    for: "creator_profile_theme_bg",
    acl: "public-read",
    image: {
      maxDimension: 2048,
      format: "webp",
      quality: 82,
      maxOutputSize: mb(1),
    },
    context: profileContext,
    resolved: resolvedProfileContext,
    forId: (c) => c.profileId,
    keyPrefix: (c) => `creator-profiles/${c.profileId}/theme-bg`,
  }),

  /** Images placed inside a profile's content blocks. */
  creatorBlockImage: definePreset({
    label: "Creator block image",
    description: "Images used inside a creator profile's content blocks.",
    access: "creator",
    accept: IMAGE_TYPES,
    maxFileSize: mb(25),
    maxFiles: 12,
    maxTotalSize: mb(150),
    for: "creator_profile_block_image",
    acl: "public-read",
    image: {
      maxDimension: 1600,
      format: "webp",
      quality: 82,
      maxOutputSize: mb(0.6),
    },
    context: profileContext,
    resolved: resolvedProfileContext,
    forId: (c) => c.profileId,
    keyPrefix: (c) => `creator-profiles/${c.profileId}/block-image`,
  }),

  /**
   * The general-purpose admin library at /admin/files. Deliberately the most
   * permissive preset — it is the one place non-image assets are accepted.
   */
  mediaLibrary: definePreset({
    label: "Media library",
    description: "General uploads from the admin Media Files page.",
    access: "admin",
    accept: [
      ...IMAGE_TYPES,
      "image/svg+xml",
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "application/pdf",
    ],
    maxFileSize: mb(200),
    maxFiles: 40,
    maxTotalSize: mb(1024),
    for: "library",
    acl: "public-read",
    image: {
      maxDimension: 2560,
      format: "webp",
      quality: 82,
      maxOutputSize: mb(1.5),
    },
    context: z.object({ category: z.string().min(1).max(64).default("library") }),
    forId: (c) => c.category,
    keyPrefix: (c) => `uploads/${c.category}`,
  }),
} as const;

export type UploadPresetName = keyof typeof uploadPresets;

/** Context a call site must supply for a given preset. */
export type UploadContext<K extends UploadPresetName> = z.input<
  (typeof uploadPresets)[K]["context"]
>;

export const isUploadPresetName = (name: string): name is UploadPresetName =>
  Object.hasOwn(uploadPresets, name);

export const getPreset = <K extends UploadPresetName>(name: K) =>
  uploadPresets[name];

/**
 * Constraints only — safe to hand to the browser and to render in the admin UI
 * without leaking key layouts or ACL choices.
 */
export const presetConstraints = (name: UploadPresetName) => {
  const p = uploadPresets[name];
  return {
    name,
    label: p.label,
    description: p.description,
    access: p.access,
    accept: [...p.accept],
    maxFileSize: p.maxFileSize,
    maxFiles: p.maxFiles,
    maxTotalSize: p.maxTotalSize,
    image: p.image ? { ...p.image } : null,
  };
};

export type PresetConstraints = ReturnType<typeof presetConstraints>;

export const allPresetConstraints = (): PresetConstraints[] =>
  (Object.keys(uploadPresets) as UploadPresetName[]).map(presetConstraints);
