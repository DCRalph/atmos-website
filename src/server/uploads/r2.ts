import "server-only";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

/**
 * Low-level Cloudflare R2 object operations, over R2's S3-compatible API. No
 * database, no validation, no policy — the only module in the app that talks
 * to the bucket directly.
 *
 * R2 has no per-object ACLs: the bucket is reachable through its public domain
 * (`R2_PUBLIC_URL`) or not at all. Objects that must stay private, like ID
 * portraits, rely on unguessable keys and are only ever served through routes
 * that check access.
 */

let cachedClient: S3Client | null = null;

const client = () => {
  cachedClient ??= new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    // The SDK otherwise signs a CRC32 checksum into presigned URLs, which the
    // browser's PUT can never match, and R2 does not support every checksum
    // the SDK would send.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return cachedClient;
};

const Bucket = () => env.R2_BUCKET;

/** How long a presigned upload URL stays valid. */
export const PRESIGN_EXPIRY_SECONDS = 15 * 60;

/** Public URL for a stored object, on the bucket's public domain. */
export const buildPublicUrl = (key: string): string =>
  `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;

/**
 * Presigned `PUT` so the browser can send bytes straight to R2. The signature
 * covers the content type, so a client cannot upload a different type than the
 * one the server approved.
 *
 * Content-Length is not signed. Signing it would force the browser to send a
 * matching header, which drags an extra entry into the bucket's CORS
 * `AllowedHeaders` for no benefit: the real size is verified with `headObject`
 * before the file is accepted.
 */
export const presignPut = async (opts: {
  key: string;
  contentType: string;
}): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: Bucket(),
    Key: opts.key,
    ContentType: opts.contentType,
  });
  return getSignedUrl(client(), command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });
};

/**
 * Presigned `GET`, for responses the public domain cannot give, like forcing a
 * download under the original file name.
 */
export const presignGet = async (opts: {
  key: string;
  contentDisposition?: string;
}): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: Bucket(),
    Key: opts.key,
    ResponseContentDisposition: opts.contentDisposition,
  });
  return getSignedUrl(client(), command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });
};

export type ObjectHead = {
  size: number;
  contentType: string;
  eTag?: string;
};

/** Metadata for an object, or null when it does not exist. */
export const headObject = async (key: string): Promise<ObjectHead | null> => {
  try {
    const res = await client().send(
      new HeadObjectCommand({ Bucket: Bucket(), Key: key }),
    );
    return {
      size: res.ContentLength ?? 0,
      contentType: res.ContentType ?? "application/octet-stream",
      eTag: res.ETag ?? undefined,
    };
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
};

export const putBuffer = async (opts: {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<void> => {
  await client().send(
    new PutObjectCommand({
      Bucket: Bucket(),
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
      CacheControl: opts.cacheControl,
    }),
  );
};

/** Server-side copy — the bytes never travel through this process. */
export const copyObject = async (opts: {
  fromKey: string;
  toKey: string;
  contentType: string;
}): Promise<void> => {
  await client().send(
    new CopyObjectCommand({
      Bucket: Bucket(),
      CopySource: `${Bucket()}/${encodeURIComponent(opts.fromKey).replace(/%2F/g, "/")}`,
      Key: opts.toKey,
      ContentType: opts.contentType,
      MetadataDirective: "REPLACE",
    }),
  );
};

export const deleteObject = async (key: string): Promise<void> => {
  await client().send(new DeleteObjectCommand({ Bucket: Bucket(), Key: key }));
};

/** Batch delete, chunked to the API's 1000-key limit. */
export const deleteObjects = async (keys: string[]): Promise<void> => {
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    if (chunk.length === 0) continue;
    await client().send(
      new DeleteObjectsCommand({
        Bucket: Bucket(),
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
};

export type ObjectStream = {
  stream: NodeJS.ReadableStream;
  contentType: string;
  contentLength?: number;
  lastModified?: string;
  eTag?: string;
};

/** Streams an object, for private files served through access-checked routes. */
export const getObjectStream = async (key: string): Promise<ObjectStream> => {
  const res = await client().send(
    new GetObjectCommand({ Bucket: Bucket(), Key: key }),
  );
  return {
    stream: res.Body as unknown as NodeJS.ReadableStream,
    contentType: res.ContentType ?? "application/octet-stream",
    contentLength:
      typeof res.ContentLength === "number" ? res.ContentLength : undefined,
    lastModified: res.LastModified
      ? new Date(res.LastModified).toUTCString()
      : undefined,
    eTag: res.ETag ?? undefined,
  };
};

/** Pulls a whole object into memory. Only used for images we are about to process. */
export const getObjectBuffer = async (key: string): Promise<Buffer> => {
  const res = await client().send(
    new GetObjectCommand({ Bucket: Bucket(), Key: key }),
  );
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Object has no body: ${key}`);
  return Buffer.from(bytes);
};

const isNotFound = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e.name === "NotFound" ||
    e.name === "NoSuchKey" ||
    e.$metadata?.httpStatusCode === 404
  );
};
