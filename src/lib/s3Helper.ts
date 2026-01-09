import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, type ObjectCannedACL } from '@aws-sdk/client-s3'
import { createHash } from 'crypto'
import { db } from '~/server/db'
import { v4 as uuidv4 } from 'uuid'
import { env } from '~/env'
import { FileUploadStatus, FileCategory } from '~Prisma/client'
import type { NextApiResponse } from 'next'

export const limits = {
  /** Maximum file size 100MB */
  fileSize: 100 * 1024 * 1024,
  /** Maximum number of 10 files */
  files: 10,
  /** Maximum total size for multi-upload 500MB */
  totalSize: 500 * 1024 * 1024,
  /** Maximum concurrent uploads */
  concurrency: 5,
}

type UploadBufferParams = {
  buffer: Buffer
  key: string
  contentType: string
  acl?: ObjectCannedACL
  name?: string
  fileType?: string
  for?: string
  forId?: string
  /** User ID of the user uploading the file */
  userId?: string
  /** Image/video width in pixels */
  width?: number
  /** Image/video height in pixels */
  height?: number
  /** Skip duplicate check (default: false) */
  skipDuplicateCheck?: boolean
}

type UploadBufferResult = {
  url: string
  key: string
  record: Awaited<ReturnType<typeof db.file_upload.create>>
  /** True if this file was already uploaded (duplicate) */
  isDuplicate: boolean
  /** Warning message if duplicate was found */
  warning?: string
}

let s3Client: S3Client | null = null

const getS3Client = () => {
  if (s3Client) return s3Client

  const client = new S3Client({
    region: env.AWS_REGION,
    endpoint: env.AWS_S3_ENDPOINT,
    forcePathStyle: Boolean(env.AWS_S3_ENDPOINT),
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  })
  s3Client = client
  return client
}

const calcFileSize = (buffer: Buffer) => {
  return buffer.length
}

/**
 * Compute SHA-256 hash of a buffer
 */
const computeFileHash = (buffer: Buffer): string => {
  return createHash('sha256').update(buffer).digest('hex')
}


/**
 * Get a simple category for a MIME type
 */
const getFileCategory = (mimeType: string): FileCategory => {
  if (mimeType.startsWith('image/')) return FileCategory.IMAGE
  if (mimeType.startsWith('video/')) return FileCategory.VIDEO
  if (mimeType.startsWith('audio/')) return FileCategory.AUDIO
  if (mimeType.includes('pdf')) return FileCategory.PDF
  if (mimeType.includes('document') || mimeType.includes('word')) return FileCategory.DOCUMENT
  return FileCategory.FILE
}

export const uploadBufferToS3 = async (params: UploadBufferParams): Promise<UploadBufferResult> => {
  const client = getS3Client()
  const { buffer, key, contentType, skipDuplicateCheck = false } = params

  const fileSize = calcFileSize(buffer)
  if (fileSize > limits.fileSize) {
    throw new Error(`File size exceeds limit of ${limits.fileSize} bytes`)
  }

  // Compute file hash for deduplication
  const hash = computeFileHash(buffer)

  // Check if file with same hash already exists (unless skipped)
  if (!skipDuplicateCheck) {
    const existingFile = await db.file_upload.findFirst({
      where: {
        hash,
        status: { in: [FileUploadStatus.OK] },
      },
    })

    if (existingFile) {
      // Return the existing file record with a warning
      return {
        url: existingFile.url,
        key: existingFile.key,
        record: existingFile,
        isDuplicate: true,
        warning: `File already exists: "${existingFile.name}" (uploaded ${existingFile.createdAt.toLocaleDateString()}). Skipping upload.`,
      }
    }
  }

  const acl = params.acl ?? (env.AWS_S3_ACL as ObjectCannedACL | undefined) ?? 'private'

  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: acl,
  })

  await client.send(command)

  const url = buildPublicUrl(key)
  const recordFor = params.for ?? 'other'
  const recordForId = params.forId ?? uuidv4()
  const recordName = params.name ?? key.split('/').pop() ?? 'file'
  const recordType = params.fileType ?? 'file'
  const recordCategory = getFileCategory(contentType)

  const record = await db.file_upload.create({
    data: {
      url,
      key,
      name: recordName,
      type: recordType,
      size: buffer.length,
      mimeType: contentType,
      category: recordCategory,
      hash,
      for: recordFor,
      forId: recordForId,
      status: FileUploadStatus.OK,
      acl,
      userId: params.userId ?? null,
      width: params.width ?? null,
      height: params.height ?? null,
    },
  })

  return { url, key, record, isDuplicate: false }
}

// ============ Multi-file upload types and functions ============

type MultiUploadFileInput = {
  /** Unique identifier for tracking this file in results */
  id: string
  buffer: Buffer
  /** S3 key (path) for the file */
  key: string
  contentType: string
  acl?: ObjectCannedACL
  name?: string
  fileType?: string
  for?: string
  forId?: string
  /** User ID of the user uploading the file */
  userId?: string
}

type MultiUploadSuccess = {
  id: string
  status: 'success'
  url: string
  key: string
  record: Awaited<ReturnType<typeof db.file_upload.create>>
  /** True if this file was already uploaded (duplicate) */
  isDuplicate: boolean
  /** Warning message if duplicate was found */
  warning?: string
}

type MultiUploadFailure = {
  id: string
  status: 'error'
  error: string
  key: string
}

type MultiUploadResult = MultiUploadSuccess | MultiUploadFailure

type MultiUploadSummary = {
  total: number
  successful: number
  failed: number
  /** Number of files that were duplicates (already uploaded) */
  duplicates: number
  results: MultiUploadResult[]
  successfulUploads: MultiUploadSuccess[]
  failedUploads: MultiUploadFailure[]
  /** Uploads that were duplicates (subset of successfulUploads) */
  duplicateUploads: MultiUploadSuccess[]
}

type MultiUploadOptions = {
  /** Maximum concurrent uploads (default: limits.concurrency) */
  concurrency?: number
  /** Callback for progress updates */
  onProgress?: (progress: {
    completed: number
    total: number
    current?: MultiUploadResult
  }) => void
  /** Continue uploading remaining files even if some fail */
  continueOnError?: boolean
}

/**
 * Upload multiple files to S3 in parallel with controlled concurrency.
 * 
 * @param files - Array of files to upload
 * @param options - Upload options including concurrency limit and callbacks
 * @returns Summary of upload results including successes and failures
 * 
 * @example
 * ```ts
 * const results = await uploadMultipleFilesToS3([
 *   { id: '1', buffer: buf1, key: 'uploads/file1.jpg', contentType: 'image/jpeg' },
 *   { id: '2', buffer: buf2, key: 'uploads/file2.png', contentType: 'image/png' },
 * ], {
 *   concurrency: 3,
 *   onProgress: ({ completed, total }) => console.log(`${completed}/${total}`),
 * })
 * ```
 */
export const uploadMultipleFilesToS3 = async (
  files: MultiUploadFileInput[],
  options: MultiUploadOptions = {}
): Promise<MultiUploadSummary> => {
  const {
    concurrency = limits.concurrency,
    onProgress,
    continueOnError = true
  } = options

  // Validate file count
  if (files.length > limits.files) {
    throw new Error(`Too many files. Maximum allowed: ${limits.files}, received: ${files.length}`)
  }

  // Validate total size
  const totalSize = files.reduce((sum, f) => sum + f.buffer.length, 0)
  if (totalSize > limits.totalSize) {
    throw new Error(
      `Total file size exceeds limit. Maximum: ${formatBytes(limits.totalSize)}, received: ${formatBytes(totalSize)}`
    )
  }

  // Validate individual file sizes
  for (const file of files) {
    if (file.buffer.length > limits.fileSize) {
      throw new Error(
        `File "${file.name ?? file.key}" exceeds size limit. Maximum: ${formatBytes(limits.fileSize)}, received: ${formatBytes(file.buffer.length)}`
      )
    }
  }

  const results: MultiUploadResult[] = []
  let completed = 0
  let shouldStop = false

  // Process files with controlled concurrency using a semaphore pattern
  const uploadFile = async (file: MultiUploadFileInput): Promise<MultiUploadResult> => {
    if (shouldStop && !continueOnError) {
      return {
        id: file.id,
        status: 'error',
        error: 'Upload cancelled due to previous error',
        key: file.key,
      }
    }

    try {
      const result = await uploadBufferToS3({
        buffer: file.buffer,
        key: file.key,
        contentType: file.contentType,
        acl: file.acl,
        name: file.name,
        fileType: file.fileType,
        for: file.for,
        forId: file.forId,
        userId: file.userId,
      })

      const success: MultiUploadSuccess = {
        id: file.id,
        status: 'success',
        url: result.url,
        key: result.key,
        record: result.record,
        isDuplicate: result.isDuplicate,
        warning: result.warning,
      }

      completed++
      onProgress?.({ completed, total: files.length, current: success })

      return success
    } catch (err) {
      const failure: MultiUploadFailure = {
        id: file.id,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
        key: file.key,
      }

      if (!continueOnError) {
        shouldStop = true
      }

      completed++
      onProgress?.({ completed, total: files.length, current: failure })

      return failure
    }
  }

  // Process in batches with controlled concurrency
  const chunks = chunkArray(files, concurrency)

  for (const chunk of chunks) {
    if (shouldStop && !continueOnError) break

    const chunkResults = await Promise.all(chunk.map(uploadFile))
    results.push(...chunkResults)
  }

  // Separate successes and failures
  const successfulUploads = results.filter(
    (r): r is MultiUploadSuccess => r.status === 'success'
  )
  const failedUploads = results.filter(
    (r): r is MultiUploadFailure => r.status === 'error'
  )
  const duplicateUploads = successfulUploads.filter((r) => r.isDuplicate)

  return {
    total: files.length,
    successful: successfulUploads.length,
    failed: failedUploads.length,
    duplicates: duplicateUploads.length,
    results,
    successfulUploads,
    failedUploads,
    duplicateUploads,
  }
}

/**
 * Helper to chunk an array into smaller arrays
 */
const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/**
 * Format bytes to human readable string
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Prepare files from FormData for multi-upload.
 * Extracts File objects and converts them to the format needed for uploadMultipleFilesToS3.
 * 
 * @param formData - FormData containing files
 * @param fieldName - Name of the form field containing files
 * @param keyPrefix - Prefix for S3 keys (e.g., 'uploads/gigs/')
 * @param options - Additional options for all files
 * @returns Array of prepared file inputs ready for upload
 */
export const prepareFilesFromFormData = async (
  formData: FormData,
  fieldName: string,
  keyPrefix: string,
  options?: {
    for?: string
    forId?: string
  }
): Promise<MultiUploadFileInput[]> => {
  const files = formData.getAll(fieldName) as File[]

  if (!files.length) {
    return []
  }

  const prepared: MultiUploadFileInput[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!file || !(file instanceof File)) continue

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const ext = file.name.split('.').pop() ?? ''
    const uniqueId = uuidv4()
    const key = `${keyPrefix.replace(/\/$/, '')}/${uniqueId}${ext ? `.${ext}` : ''}`

    prepared.push({
      id: uniqueId,
      buffer,
      key,
      contentType: file.type || 'application/octet-stream',
      name: file.name,
      fileType: getFileCategory(file.type),
      for: options?.for,
      forId: options?.forId,
    })
  }

  return prepared
}


export const buildPublicUrl = (key: string) => {
  if (env.AWS_S3_PUBLIC_URL_BASE) {
    const base = env.AWS_S3_PUBLIC_URL_BASE.replace(/\/$/, '')
    return `${base}/${key}`
  }
  const bucket = env.AWS_S3_BUCKET
  const region = env.AWS_REGION
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

export const streamToBuffer = async (stream: NodeJS.ReadableStream) => {
  const chunks: Uint8Array[] = []
  let totalLength = 0
  return await new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (chunk: any) => {
      let part: Uint8Array
      if (typeof chunk === 'string') {
        part = new Uint8Array(Buffer.from(chunk))
      } else if (chunk instanceof Uint8Array) {
        part = new Uint8Array(chunk)
      } else {
        part = new Uint8Array(Buffer.from(chunk))
      }
      chunks.push(part)
      totalLength += part.length
    })
    stream.on('end', () => {
      const out = new Uint8Array(totalLength)
      let offset = 0
      for (const c of chunks) {
        out.set(c, offset)
        offset += c.length
      }
      resolve(Buffer.from(out))
    })
    stream.on('error', (err) => reject(err))
  })
}

type GetObjectResult = {
  stream: NodeJS.ReadableStream
  contentType: string
  contentLength?: number
  lastModified?: string
  eTag?: string
}

export const getS3ObjectStream = async (key: string): Promise<GetObjectResult> => {
  const client = getS3Client()
  const res = await client.send(new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }))

  const stream = res.Body as unknown as NodeJS.ReadableStream
  return {
    stream,
    contentType: res.ContentType ?? 'application/octet-stream',
    contentLength: typeof res.ContentLength === 'number' ? res.ContentLength : undefined,
    lastModified: res.LastModified ? new Date(res.LastModified).toUTCString() : undefined,
    eTag: res.ETag ?? undefined,
  }
}

export const getS3FromDbId = async (id: string): Promise<GetObjectResult> => {
  const record = await db.file_upload.findUnique({
    where: {
      id,
      status: FileUploadStatus.OK,
    },
    select: {
      key: true,
    }
  })
  if (!record) throw new Error('File not found')
  return getS3ObjectStream(record.key)
}

export const forwardS3ObjectToReply = async (opts: {
  key: string
  res: NextApiResponse
  asAttachmentName?: string
  cacheSeconds?: number
}) => {
  const { key, res, asAttachmentName, cacheSeconds } = opts
  const { stream, contentType, contentLength, lastModified, eTag } = await getS3ObjectStream(key)

  res.setHeader('Content-Type', contentType)
  if (typeof contentLength === 'number') res.setHeader('Content-Length', String(contentLength))
  if (lastModified) res.setHeader('Last-Modified', lastModified)
  if (eTag) res.setHeader('ETag', eTag)
  if (typeof cacheSeconds === 'number') res.setHeader('Cache-Control', `public, max-age=${cacheSeconds}`)
  if (asAttachmentName) res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(asAttachmentName)}"`)

  return res.send(stream)
}


export const softDeleteFile = async (fileIdOrKey: { id?: string; key?: string }) => {
  const identifier = fileIdOrKey.id ? { id: fileIdOrKey.id } : fileIdOrKey.key ? { key: fileIdOrKey.key } : null
  if (!identifier) throw new Error('softDeleteFile requires either id or key')

  const record = await db.file_upload.update({
    where: identifier as any,
    data: { status: FileUploadStatus.SOFT_DELETED },
  })

  return record
}

export const deleteFile = async (fileIdOrKey: { id?: string; key?: string }) => {
  const identifier = fileIdOrKey.id ? { id: fileIdOrKey.id } : fileIdOrKey.key ? { key: fileIdOrKey.key } : null
  if (!identifier) throw new Error('deleteFile requires either id or key')

  const existing = await db.file_upload.findUnique({ where: identifier as any })
  if (!existing) throw new Error('File not found')

  const client = getS3Client()
  await client.send(new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: existing.key }))

  const record = await db.file_upload.update({
    where: { id: existing.id },
    data: { status: FileUploadStatus.DELETED },
  })

  return record
}


// ============ URL Builder Functions ============
// Re-exported from media-url.ts for backwards compatibility
// Import directly from '~/lib/media-url' for client-side usage

export { buildMediaUrl, buildGigImageUrl, getMediaDisplayUrl } from './media-url'

