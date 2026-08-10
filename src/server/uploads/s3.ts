import "server-only";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  type ObjectCannedACL,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "~/env";

/**
 * Low-level S3 object operations. No database, no validation, no policy — the
 * only module in the app that talks to the bucket directly.
 */

let cachedClient: S3Client | null = null;

const client = () => {
  cachedClient ??= new S3Client({
    region: env.AWS_REGION,
    endpoint: env.AWS_S3_ENDPOINT,
    forcePathStyle: Boolean(env.AWS_S3_ENDPOINT),
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return cachedClient;
};

const Bucket = () => env.AWS_S3_BUCKET;

/** How long a presigned upload URL stays valid. */
export const PRESIGN_EXPIRY_SECONDS = 15 * 60;

/** Public URL for a stored object, via the CDN base when one is configured. */
export const buildPublicUrl = (key: string): string => {
  if (env.AWS_S3_PUBLIC_URL_BASE) {
    return `${env.AWS_S3_PUBLIC_URL_BASE.replace(/\/$/, "")}/${key}`;
  }
  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
};

/**
 * Presigned `PUT` so the browser can send bytes straight to S3. The signature
 * covers the content type, so a client cannot upload a different type than the
 * one the server approved.
 *
 * Neither Content-Length nor the ACL is signed. Signing them would force the
 * browser to send matching `content-length`/`x-amz-acl` headers, which drags
 * extra entries into the bucket's CORS `AllowedHeaders` for no benefit: the
 * real size is verified with `headObject` before the file is accepted, and the
 * final ACL is applied server-side when the object is moved out of staging.
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
  acl: ObjectCannedACL;
  cacheControl?: string;
}): Promise<void> => {
  await client().send(
    new PutObjectCommand({
      Bucket: Bucket(),
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
      ACL: opts.acl,
      CacheControl: opts.cacheControl,
    }),
  );
};

/** Server-side copy — the bytes never travel through this process. */
export const copyObject = async (opts: {
  fromKey: string;
  toKey: string;
  contentType: string;
  acl: ObjectCannedACL;
}): Promise<void> => {
  await client().send(
    new CopyObjectCommand({
      Bucket: Bucket(),
      CopySource: `${Bucket()}/${encodeURIComponent(opts.fromKey).replace(/%2F/g, "/")}`,
      Key: opts.toKey,
      ContentType: opts.contentType,
      MetadataDirective: "REPLACE",
      ACL: opts.acl,
    }),
  );
};

export const deleteObject = async (key: string): Promise<void> => {
  await client().send(new DeleteObjectCommand({ Bucket: Bucket(), Key: key }));
};

/** Batch delete, chunked to S3's 1000-key limit. */
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

/** Streams an object, for serving through `/api/media/[id]`. */
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
