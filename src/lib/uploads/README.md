# Uploads

One system for every file that reaches the R2 bucket. Adding a new upload
location means adding a preset — not writing an upload path.

## How a file gets to R2

```
browser                         server (tRPC)                    R2
   |                                 |                            |
   |  1. hash the file (SHA-256)     |                            |
   |  2. uploads.start ------------->| authorize (permission + owner) |
   |                                 |  validate name/size/type   |
   |                                 |  dedupe on source hash     |
   |                                 |  reserve file_upload row   |
   |                                 |  presign PUT               |
   |<-- { uploadId, uploadUrl } -----|                            |
   |                                                              |
   |  3. PUT the raw bytes, with progress ----------------------->| _staging/<uploadId>
   |                                                              |
   |  4. uploads.finish ------------>|  HEAD the real object      |
   |                                 |  re-check size + type      |
   |                                 |  sharp: resize/convert --->| <final key>
   |                                 |  (or server-side copy)     |
   |                                 |  flip the row to OK        |
   |<-- UploadedFile ----------------|                            |
```

Bytes never pass through the app server, so there is no request-body size
limit — the 4.5 MB cap that applies to serverless functions is irrelevant here.
Validation is still entirely server-side: `start` checks what the client
*claims*, and `finish` re-checks the object that actually landed before it is
published.

## Adding a new upload location

1. Add a preset to [`presets.ts`](./presets.ts):

   ```ts
   pressKit: definePreset({
     label: "Press kit",
     description: "Downloadable press assets on the about page.",
     access: "admin",
     accept: ["application/pdf", "image/jpeg", "image/png"],
     maxFileSize: mb(50),
     maxFiles: 5,
     maxTotalSize: mb(150),
     for: "press_kit",
     image: { maxDimension: 2048, format: "webp", quality: 82, maxOutputSize: mb(1) },
     context: z.object({ year: z.string().min(4) }),
     forId: (c) => c.year,
     keyPrefix: (c) => `press-kit/${c.year}`,
   }),
   ```

2. Add its access rule to `resolvers` in
   [`~/server/uploads/authorize.ts`](../../server/uploads/authorize.ts). This is
   a `Record<UploadPresetName, Resolver>`, so leaving it out is a compile error —
   a preset cannot ship without an access decision.

3. Use it:

   ```tsx
   <UploadDropzone preset="pressKit" context={{ year }} onComplete={handle} />
   // or
   <ImageUploadField preset="pressKit" context={{ year }} value={id} onChange={setId} />
   // or, for a custom UI
   const { upload, items, isUploading, accept } = useUpload("pressKit", { context: { year } });
   ```

Constraints, the `accept` attribute, and the helper text under every control all
come from the preset. Nothing at the call site repeats them.

## Constraints

| Field | What it bounds |
| --- | --- |
| `accept` | MIME types, exact (`application/pdf`) or wildcard (`image/*`) |
| `maxFileSize` | Largest single source file |
| `maxFiles` | Files per batch |
| `maxTotalSize` | Combined source size per batch |
| `image.maxDimension` / `maxWidth` / `maxHeight` | Pixel bounds; images scale down, never up |
| `image.format` | `webp` / `jpeg` / `png` / `avif` / `original` |
| `image.quality`, `minQuality` | Encoder quality and the floor for back-off |
| `image.maxOutputSize` | Ceiling on the *encoded* result — quality steps down, then dimensions, until it fits |

Images have EXIF stripped by default (`keepMetadata: true` to keep it) — phone
photos routinely carry GPS coordinates. Orientation is applied before the
metadata is dropped. Animated GIFs are stored untouched unless
`passThroughAnimated: false`, since resizing flattens them to one frame.

## Deduplication

The browser hashes each file before uploading. If that hash already exists
**at the same destination** (`for` + `forId`), `start` returns the existing file
and nothing is transferred. Scoping to the destination is deliberate: the same
photo on two gigs should be two records, so deleting one cannot break the other.

A second check runs at `finish` against the stored bytes, covering clients that
skipped hashing (files over 256 MB, or no `crypto.subtle`).

## Required bucket CORS

Direct-to-R2 uploads need the bucket to accept cross-origin `PUT`s. Without
this, uploads fail with a network error and the UI says so explicitly.

```json
[
  {
    "AllowedOrigins": [
      "https://atmosmedia.co.nz",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Apply it under **R2 → bucket → Settings → CORS Policy**,
adding any preview domains you upload from.

Only `content-type` is signed into the presigned URL. Content-Length
deliberately is not: signing it would drag another header into
`AllowedHeaders` for no benefit, since the real size is verified server-side
with `HeadObject`.

## Public access

R2 has no per-object ACLs. Every object is reachable on the bucket's public
domain (`R2_PUBLIC_URL`) if you know its key. Keys end in a random UUID, so
objects that must stay private (staging uploads, ID portraits) cannot be
guessed, and the app only hands those out through routes that check access.
The site itself serves media through `/api/media/[id]`.

## Abandoned uploads

An upload that starts and never finishes leaves an object under `_staging/`
and a `file_upload` row in `UPLOADING`. Nothing serves either. Clear them from
**Admin → Media Files → Upload targets**, or call
`uploads.sweepStale({ olderThanHours })` from a cron job.
