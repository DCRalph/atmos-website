# Media files

Every uploaded file (posters, gig photos, avatars, Will GPT attachments, the
admin media library) is stored in one Cloudflare R2 bucket and tracked by one
`file_upload` row. The browser sends the bytes straight to R2, and the app
server only issues permissions, checks the result, and keeps the records.

What each upload location accepts is defined in code, as a **preset**. Adding
a new place to upload means adding a preset, not writing a new upload path.
The step-by-step recipe for that lives in
[`src/lib/uploads/README.md`](../src/lib/uploads/README.md).

## Map

| Layer | File | Role |
| --- | --- | --- |
| Config | `src/env.js` | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` |
| Presets | `src/lib/uploads/presets.ts` | Every upload target and its limits. Client-safe |
| Validation | `src/lib/uploads/validate.ts` | MIME resolution, size/type/batch checks, helper text. Shared by client and server |
| Types | `src/lib/uploads/types.ts` | `ImageProcessing`, `UploadedFile`, `mb()` / `kb()` |
| R2 client | `src/server/uploads/r2.ts` | The only module that talks to the bucket |
| Pipeline | `src/server/uploads/service.ts` | `startUpload`, `finishUpload`, `uploadFromBuffer`, `abortUpload`, `sweepStaleUploads` |
| Access | `src/server/uploads/authorize.ts` | Per-preset permission check and context resolution |
| Images | `src/server/uploads/process-image.ts` | `sharp` resize, convert, and size ceiling |
| Row ops | `src/server/uploads/files.ts` | Soft and hard delete, category mapping |
| Library query | `src/server/uploads/image-selection.ts` | Which existing files can fill a given image field |
| tRPC | `src/server/api/routers/uploads.ts` | Upload control plane |
| tRPC | `src/server/api/routers/files.ts` | Media library: list, edit, tag, delete, restore |
| Serving | `src/app/api/media/[id]/route.ts` | Stable public URL for a file |
| URLs | `src/lib/media-url.ts` | Builds `/api/media/<id>` URLs on client and server |
| Client | `src/hooks/use-upload.ts` | The one client upload entry point |
| UI | `src/components/uploads/*` | Reusable upload fields |
| Admin | `src/app/(admin)/admin/files/page.tsx` | Admin → Media files |

## Storage on R2

R2 is reached through its S3-compatible API with `@aws-sdk/client-s3`
(`region: "auto"`, endpoint `https://<account>.r2.cloudflarestorage.com`).
Checksum calculation is set to `WHEN_REQUIRED`, because the SDK would otherwise
sign a CRC32 into presigned URLs that a browser PUT can never match.

`r2.ts` exposes a small set of operations and nothing else:

| Function | Used for |
| --- | --- |
| `presignPut` | Browser upload URL (15 min). Signs `Content-Type` only |
| `presignGet` | Short-lived download URL with a `Content-Disposition` |
| `headObject` | Verifying what actually landed in staging |
| `putBuffer` | Writing processed images, reports, ID portraits |
| `copyObject` | Server-side move from staging to the final key |
| `getObjectBuffer` / `getObjectStream` | Reading bytes for processing, OG images, wallet passes, private routes |
| `deleteObject` / `deleteObjects` | Cleanup (batched in chunks of 1000) |
| `buildPublicUrl` | `R2_PUBLIC_URL/<key>` |

### Key layout

Keys are `<preset keyPrefix>/<random UUID>.<ext>`, for example
`gigs/<gigId>/poster/3f1c….webp`. Unverified bytes sit at
`_staging/<uploadId>` until `finish` moves them.

R2 has no per-object ACLs. Anything in the bucket can be fetched on
`R2_PUBLIC_URL` by anyone who knows the key, so privacy relies on keys
containing a random UUID and on the app only handing out keys through routes
that check access.

### Bucket CORS

Direct uploads need the bucket to allow cross-origin `PUT` with a
`content-type` header from the site and `localhost:3000`. The exact policy is
in the [uploads README](../src/lib/uploads/README.md#required-bucket-cors).
Without it, uploads fail with a network error and the UI says to check CORS.

## Data model

`file_upload` (in `prisma/schema.prisma`) is the record for every file:

| Field | Meaning |
| --- | --- |
| `key`, `url` | R2 key and its public URL |
| `name`, `mimeType`, `size` | Original name, stored type, stored size |
| `originalSize` | Size before processing, so the admin UI can show the savings |
| `category`, `type` | `IMAGE` / `VIDEO` / `AUDIO` / `PDF` / `DOCUMENT` / `FILE` (and its legacy lowercase string) |
| `width`, `height` | Pixel size, when known |
| `hash` | SHA-256 of the stored bytes (after processing) |
| `sourceHash` | SHA-256 of the file the user picked, for dedupe before upload |
| `preset` | Which preset produced it (null on pre-preset rows) |
| `for`, `forId` | The destination, e.g. `gig_poster` + gig id |
| `status` | `UPLOADING` → `OK`, or `ERRORED`, `SOFT_DELETED`, `DELETED` |
| `userId` | Who uploaded it. Only they can finish or abort it |
| `fileTags` | Many-to-many with `file_tag`, for organising the library |

Other models point at a file by id: `Gig.posterFileUploadId` and
`widePosterFileUploadId`, `GigMedia.fileUploadId`, `ArtistProfile.avatarFileId`
and `bannerFileId`, `Venue.logoFileId`, `TicketEvent.posterFileUploadId`, and so on.
Most of these are plain string columns with no foreign key. `ContentItem.image`
is the one real relation (`onDelete: SetNull`).

## Presets

A preset (`definePreset` in `presets.ts`) sets:

- `access`: `admin` or `artist`
- `accept`, `maxFileSize`, `maxFiles`, `maxTotalSize`
- `image`: processing rules (max dimension, output format, quality, `maxOutputSize`)
- `context`: a Zod schema for what the call site sends, e.g. `{ gigId }`
- `for` / `forId` / `keyPrefix`: where rows and objects land

`UploadPresetName` is inferred from the object, and `UploadContext<K>` is
inferred from each preset's schema, so `useUpload("gigPoster", { context })`
is type-checked against that preset's context.

| Preset | Access | Accepts | Max file | Images become | Key prefix |
| --- | --- | --- | --- | --- | --- |
| `gigMedia` | admin | images, mp4/mov/webm | 200 MB, 40 files | webp ≤2048 px | `gigs/<gigId>` |
| `gigPoster` | admin | images | 50 MB | webp ≤2048 px | `gigs/<gigId>/poster` |
| `gigWidePoster` | admin | images | 50 MB | webp ≤2560 px | `gigs/<gigId>/wide-poster` |
| `ticketEventPoster` | admin | images | 50 MB | webp ≤2048 px | `ticket-events/posters` |
| `ticketPassImage` | admin | images | 25 MB | webp ≤2048 px | `ticket-events/passes` |
| `contentArtwork` | admin | images | 25 MB | webp ≤2048 px | `content/artwork` |
| `crewPhoto` | admin | images | 25 MB | webp ≤896 px | `crew` |
| `venueLogo` | admin | images | 10 MB | webp ≤512 px | `venues` |
| `taskProof` | admin | images | 15 MB, 20 files | webp ≤2048 px | `tasks/<taskId>` |
| `artistAvatar` | artist | images | 25 MB | webp ≤896 px | `artist-profiles/<id>/avatar` |
| `artistBanner` | artist | images | 25 MB | webp ≤2048 px | `artist-profiles/<id>/banner` |
| `artistThemeBackground` | artist | images | 25 MB | webp ≤2048 px | `artist-profiles/<id>/theme-bg` |
| `artistBlockImage` | artist | images | 25 MB, 12 files | webp ≤1600 px | `artist-profiles/<id>/block-image` |
| `mediaLibrary` | admin | images, video, audio, PDF | 200 MB, 40 files | webp ≤2560 px | `uploads/<category>` |
| `willGptAttachment` | admin | images, PDF, text | 25 MB, 8 files | webp ≤2560 px | `will-gpt/<conversationId>` |

`presets.ts` is the source of truth; this table is a snapshot. The live version,
with how much each preset has stored, is on **Admin → Media files → Upload
targets**.

## Upload flow

```
browser (useUpload)                 server (tRPC uploads.*)                R2
   |                                       |                                 |
   | 1. validate batch against preset      |                                 |
   | 2. SHA-256 the file (≤256 MB)         |                                 |
   | 3. uploads.start ------------------->| authorizeUpload                 |
   |                                       | validateFile                    |
   |                                       | dedupe on sourceHash            |
   |                                       | create row (UPLOADING)          |
   |                                       | presignPut(_staging/<id>)       |
   |<----- { uploadId, uploadUrl } --------|                                 |
   |                                                                         |
   | 4. XHR PUT raw bytes, with progress ----------------------------------->| _staging/<id>
   |                                                                         |
   | 5. uploads.finish ------------------>| headObject: re-check size/type  |
   |                                       | image? sharp → putBuffer ------>| <final key>
   |                                       | else      copyObject ---------->| <final key>
   |                                       | dedupe on stored hash           |
   |                                       | row → OK, delete staging        |
   |<----- UploadedFile -------------------|                                 |
```

### `uploads.start` → `startUpload`

1. `authorizeUpload` loads the user, enforces the preset's `access`, parses the
   context with the preset's schema, then runs that preset's **resolver**. The
   resolver checks the target exists (gig, task) or resolves "my profile" and
   enforces owner-or-admin for artist presets. `resolvers` is typed
   `Record<UploadPresetName, Resolver>`, so a preset without an access rule
   does not compile.
2. `validateFile` checks the claimed name, size and type against the preset.
3. If the browser sent a `sourceHash` and an `OK` file with that hash already
   exists **for the same `for` + `forId`**, it returns `status: "duplicate"`
   and nothing is transferred. Dedupe is scoped to the destination on purpose,
   so deleting a photo from one gig never breaks another.
4. Otherwise it creates the `file_upload` row in `UPLOADING` and returns a
   presigned PUT URL for `_staging/<uploadId>`.

### Browser PUT

`useUpload` sends the file with `XMLHttpRequest` (for upload progress), three
files at a time by default. The bytes never touch Vercel, so the 4.5 MB
function body limit does not apply.

### `uploads.finish` → `finishUpload`

Only the user who started the upload can finish it. Then:

1. `headObject` on the staging key. The real size and type are re-checked
   against the preset, since `start` only saw what the client claimed.
2. **Images sharp can decode** (jpeg, png, webp, avif, gif, tiff, heic) are
   processed: orientation applied, EXIF stripped (phone photos carry GPS),
   scaled down to the preset's bounds, converted to its format. If the preset
   sets `maxOutputSize`, quality and then dimensions step down until it fits.
   Animated GIFs pass through untouched by default. The result is written with
   `Cache-Control: public, max-age=31536000, immutable`.
3. **Everything else** (video, PDF, SVG, audio) is copied server-side from
   staging to the final key. Images up to 20 MB are still read once to record
   real dimensions and a verified hash.
4. A second dedupe pass runs on the stored hash, for clients that could not
   hash (files over 256 MB, no `crypto.subtle`). A twin replaces the new row.
5. The row flips to `OK` with the final key, URL, size, type and dimensions,
   and the staging object is deleted.

Any failure marks the row `ERRORED` and deletes the staging object.

### Other ways in

- **`uploads.importFromUrl`** downloads an image from a link and runs it through
  a preset.
- **`uploads.copyFromWillGptAttachment`** copies a chat image into a site preset
  (poster, artist avatar, etc.), applying that preset's processing.
- **`gig-import`** turns an Instagram image into a gig poster.

All three call `uploadFromBuffer`, which hashes the bytes, calls `startUpload`,
puts the bytes at the same staging key a browser would, then calls
`finishUpload`. There is one path into `file_upload`, not several.

### Attaching to an entity

Uploading only creates a file. The call site then stores the returned id with
the destination's own procedure, for example `gigs.addExistingMedia` after a
`gigMedia` upload, or `gigs.setPosterFromUpload`. When a poster or gig photo is
replaced or removed, the old file is soft-deleted (`softDeleteFile`).

## Serving files

### `/api/media/[id]`

`buildMediaUrl(id)` gives `<app>/api/media/<id>`, the address the site stores
and renders. The route looks up an `OK` row and:

- **Normal files:** 307 redirect to `R2_PUBLIC_URL/<key>`, cached for a day at
  the CDN. Not `immutable`, because a file's key can change or it can be
  deleted.
- **`?download=1`:** 307 to a presigned GET with
  `Content-Disposition: attachment` and the original filename. `no-store`.
- **`willGptAttachment` files:** require an admin session, then redirect to a
  presigned GET. `no-store`, so they are never cached publicly.

Bytes never pass through Vercel in any of these cases.

`src/lib/media-url.ts` also provides:

- `getMediaDisplayUrl(media)`: prefers the `/api/media` URL, falls back to a
  stored legacy `url`.
- `getMediaDownloadUrl(media)`: the `?download=1` variant.
- `mediaFileIdFromUrl(url)`: recovers the file id from a stored media URL, so
  fields that save a URL can still preview and replace by id.

### Server-side readers

Some features read the bytes directly with `getObjectBuffer`: OG image
rendering (`src/server/og-image.ts`), gig teasers
(`/api/gigs/[gigId]/teaser`), wallet pass images
(`src/server/wallet/pass-images.ts`), and Will GPT attachment transcription.

### Files outside this system

Two kinds of objects use `r2.ts` directly and never get a `file_upload` row,
because `/api/media` would make them public:

- **ID portraits** (`src/server/ticketing/id-photos.ts`): stored at
  `door/id/<patronId>/<uuid>.jpg`, uploaded through tRPC (they are ~40 KB),
  served only by `/api/door/patron-photo/[patronId]`, which re-checks door
  access and streams with no caching. Deleted when the patron record expires.
- **HTML reports** (`src/server/api/routers/reports.ts`): stored at
  `reports/<id>/<uuid>.bin` and read back through the reports router.

## Deleting

| Action | Row | R2 object |
| --- | --- | --- |
| `files.softDelete` | `SOFT_DELETED` | kept |
| `files.restore` | back to `OK` | kept |
| `files.delete` | `DELETED` | deleted |
| `uploads.abort` | removed | staging deleted |
| `uploads.sweepStale` | `UPLOADING`/`ERRORED` rows older than N hours removed | staging deleted |

`/api/media` only serves `OK` rows, so a soft-deleted file stops resolving
through the site straight away. Its object is still in the bucket, though, and
reachable on the public domain by anyone who already has the raw R2 URL.

Abandoned uploads are not swept automatically; use the button under **Upload
targets** or call `uploads.sweepStale`.

## Client components

### `useUpload(preset, options)` (`src/hooks/use-upload.ts`)

The single client entry point. It validates the batch against the preset,
hashes, calls `start`, PUTs to R2, calls `finish`, and tracks each file's
status (`queued` → `preparing` → `uploading` → `processing` → `done`, or
`error` / `cancelled`). Progress is 90% transfer, 10% processing.

Returns `upload`, `items`, `isUploading`, `hasFailures`, `cancel`, `retry`, `reset`,
`constraints` and `accept` (for the `<input>`). Options: `context`, `tagIds`,
`concurrency`, `onFileComplete`, `onComplete` (also fires after a retry, so
completion work belongs there), and `onError`. Cancelling aborts the XHR and
calls `uploads.abort` to clean up the reservation.

### Components (`src/components/uploads/`)

| Component | What it is | Used in |
| --- | --- | --- |
| `ImageUploadField` | One image with a live preview. Admins also get "choose existing" via `MediaImagePicker` | Artist core sheet, content editor, crew dialog, venue dialog, ticket event details, wallet pass design, artist block inspector |
| `ImageGalleryField` | A grid of images on one preset, add many, remove individually | Artist block inspector |
| `MediaImagePicker` | Dialog that searches the library (`files.images`) for images that fit the destination preset's type and size rules | Inside `ImageUploadField` |
| `UploadDropzone` | Drag-and-drop surface driven by a preset | Not used yet |
| `UploadProgressList` | Per-file progress rows | Files manager, gig media manager, dropzone |

Helper text, `accept`, and limits under every control come from the preset,
via `describeConstraints`. Call sites do not repeat them.

Screens with their own UI call `useUpload` directly: the gig editor (posters),
gig media manager, gig import line-up step, artist quick-create, artist profile
editor (avatar, banner), task drawer and task tools, and the Will GPT provider.

### Admin → Media files (`/admin/files`)

Two tabs:

- **Files** (`src/components/admin/files-manager.tsx`): every `file_upload`
  row, with stats (`files.getStats`), filters by search, type, status, preset
  and tag (`files.getAll`), and the entity each file belongs to (gig, artist,
  and so on). From here an admin can preview, copy the media URL, download the
  original, rename or re-categorise (`files.updateFile`), soft-delete, restore,
  delete permanently, and manage tags in bulk. New uploads use the
  `mediaLibrary` preset.
- **Upload targets** (`src/components/admin/upload-presets-panel.tsx`): every
  preset's enforced constraints plus file count and bytes stored and saved
  (`uploads.presets`), and the stale-upload sweep.

Everything in the `files` router is admin-only, including single-file lookups,
because a TBA gig's poster file would reveal the poster the public page is
withholding.

## tRPC reference

**`uploads`**

| Procedure | Auth | Does |
| --- | --- | --- |
| `start` | signed in + preset access | Reserve, dedupe, presign |
| `finish` | uploader | Verify, process, publish |
| `abort` | uploader | Discard a pending upload |
| `importFromUrl` | admin | Fetch an image URL into a preset |
| `copyFromWillGptAttachment` | admin | Copy a chat image into a site preset |
| `presets` | admin | Constraints and usage per preset |
| `sweepStale` | admin | Remove abandoned uploads |

**`files`** (all admin)

`images`, `getAll`, `getById`, `getForEntity`, `getStats`, `updateFile`,
`softDelete`, `restore`, `delete`, `getAllTags`, `createTag`, `updateTag`,
`deleteTag`, `bulkAddTags`, `bulkRemoveTags`.
