"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { api } from "~/trpc/react";
import {
  presetConstraints,
  type UploadContext,
  type UploadPresetName,
} from "~/lib/uploads/presets";
import type { UploadedFile } from "~/lib/uploads/types";
import { acceptAttribute, validateBatch } from "~/lib/uploads/validate";

/**
 * The single client-side upload entry point.
 *
 * Every file in the app goes through here: validate against the preset, hash
 * for dedupe, ask the server for a presigned URL, PUT the bytes straight to
 * S3 with real progress, then have the server verify and process them.
 *
 * ```tsx
 * const { upload, items, isUploading, accept } = useUpload("gigPoster", {
 *   context: { gigId },
 *   onComplete: (files) => setPoster(files[0]),
 * });
 * ```
 */

export type UploadStatus =
  | "queued"
  | "preparing"
  | "uploading"
  | "processing"
  | "done"
  | "error"
  | "cancelled";

export type UploadItem = {
  /** Stable id for this attempt, for React keys. */
  id: string;
  file: File;
  status: UploadStatus;
  /** 0-100 across the whole pipeline, not just the transfer. */
  progress: number;
  error?: string;
  result?: UploadedFile;
};

export type UseUploadOptions<K extends UploadPresetName> = {
  /** Context the preset needs, e.g. `{ gigId }`. */
  context?: UploadContext<K>;
  /** File tags applied to everything uploaded through this hook. */
  tagIds?: string[];
  /** How many files transfer at once. */
  concurrency?: number;
  /** Fired as each file lands. */
  onFileComplete?: (file: UploadedFile) => void | Promise<void>;
  /**
   * Fired once per batch, with everything that succeeded. Also fires after a
   * retry, so completion work belongs here rather than after `await upload()`.
   */
  onComplete?: (files: UploadedFile[]) => void | Promise<void>;
  /** Fired for each rejected or failed file. */
  onError?: (message: string, file?: File) => void;
};

/** Above this size, hashing in the browser costs more than the dedupe saves. */
const HASH_LIMIT_BYTES = 256 * 1024 * 1024;

/** Share of the progress bar given to the S3 transfer; the rest is processing. */
const TRANSFER_SHARE = 0.9;

/** Statuses a file can be retried from. */
const RETRYABLE: UploadStatus[] = ["error", "cancelled"];

export function useUpload<K extends UploadPresetName>(
  preset: K,
  options: UseUploadOptions<K> = {},
) {
  const {
    context,
    tagIds,
    concurrency = 3,
    onFileComplete,
    onComplete,
    onError,
  } = options;

  const constraints = useMemo(() => presetConstraints(preset), [preset]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const client = api.useUtils().client;
  /** In-flight transfers, so `cancel` can abort them. */
  const transfers = useRef(new Map<string, XMLHttpRequest>());
  /** Upload ids the server has reserved, so cancelling can clean them up. */
  const reservations = useRef(new Map<string, string>());
  /**
   * Per-batch context overrides, kept by item id so a `retry` reuses the same
   * destination the original attempt was given.
   */
  const contexts = useRef(new Map<string, UploadContext<K>>());

  // Keep the latest callbacks/context without re-creating `upload` on every
  // render — callers routinely pass inline arrow functions.
  const latest = useRef({
    context,
    tagIds,
    onFileComplete,
    onComplete,
    onError,
  });
  latest.current = { context, tagIds, onFileComplete, onComplete, onError };

  // A ref mirrors the item list so `retry` can read current state without
  // doing lookups inside a setState updater (which must stay pure).
  const itemsRef = useRef<UploadItem[]>([]);
  const commit = useCallback((next: UploadItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<UploadItem>) => {
      commit(
        itemsRef.current.map((item) =>
          item.id === id ? { ...item, ...changes } : item,
        ),
      );
    },
    [commit],
  );

  const reset = useCallback(() => {
    contexts.current.clear();
    commit([]);
  }, [commit]);

  const cancel = useCallback(
    (itemId?: string) => {
      const ids = itemId ? [itemId] : [...transfers.current.keys()];
      for (const id of ids) {
        transfers.current.get(id)?.abort();
        transfers.current.delete(id);
        const uploadId = reservations.current.get(id);
        if (uploadId) {
          reservations.current.delete(id);
          void client.uploads.abort.mutate({ uploadId }).catch(() => undefined);
        }
        patch(id, { status: "cancelled", progress: 0 });
      }
    },
    [client, patch],
  );

  /** Runs one file all the way through. Resolves to null if it did not land. */
  const runOne = useCallback(
    async (item: UploadItem): Promise<UploadedFile | null> => {
      try {
        patch(item.id, {
          status: "preparing",
          progress: 1,
          error: undefined,
        });

        const sourceHash = await hashFile(item.file);

        const started = await client.uploads.start.mutate({
          preset,
          context: contexts.current.get(item.id) ?? latest.current.context,
          tagIds: latest.current.tagIds,
          file: {
            name: item.file.name,
            size: item.file.size,
            type: item.file.type,
            ...(sourceHash ? { sourceHash } : {}),
          },
        });

        if (started.status === "duplicate") {
          patch(item.id, {
            status: "done",
            progress: 100,
            result: started.file,
          });
          await latest.current.onFileComplete?.(started.file);
          return started.file;
        }

        reservations.current.set(item.id, started.uploadId);
        patch(item.id, { status: "uploading", progress: 2 });

        await putToS3({
          url: started.uploadUrl,
          headers: started.headers,
          file: item.file,
          onProgress: (fraction) =>
            patch(item.id, {
              progress: Math.max(
                2,
                Math.round(fraction * TRANSFER_SHARE * 100),
              ),
            }),
          register: (xhr) => transfers.current.set(item.id, xhr),
        });

        transfers.current.delete(item.id);
        patch(item.id, {
          status: "processing",
          progress: Math.round(TRANSFER_SHARE * 100),
        });

        const result = await client.uploads.finish.mutate({
          uploadId: started.uploadId,
        });
        reservations.current.delete(item.id);

        patch(item.id, { status: "done", progress: 100, result });
        await latest.current.onFileComplete?.(result);
        return result;
      } catch (error) {
        transfers.current.delete(item.id);
        const uploadId = reservations.current.get(item.id);
        if (uploadId) {
          reservations.current.delete(item.id);
          void client.uploads.abort.mutate({ uploadId }).catch(() => undefined);
        }
        if (isAbort(error)) {
          patch(item.id, { status: "cancelled", progress: 0 });
          return null;
        }
        const message = errorMessage(error);
        patch(item.id, { status: "error", progress: 0, error: message });
        latest.current.onError?.(message, item.file);
        return null;
      }
    },
    [client, patch, preset],
  );

  const runBatch = useCallback(
    async (batch: UploadItem[]): Promise<UploadedFile[]> => {
      if (batch.length === 0) return [];

      setIsUploading(true);
      const succeeded: UploadedFile[] = [];
      try {
        await runWithConcurrency(batch, concurrency, async (item) => {
          const result = await runOne(item);
          if (result) succeeded.push(result);
        });
        if (succeeded.length > 0) await latest.current.onComplete?.(succeeded);
      } finally {
        setIsUploading(false);
      }
      return succeeded;
    },
    [concurrency, runOne],
  );

  /**
   * `options.context` overrides the hook's context for this batch alone. Needed
   * when the destination is only known inside the call — uploading a poster
   * straight after creating the gig it belongs to, for instance, where the
   * render-captured context still has no gig id.
   */
  const upload = useCallback(
    async (
      input: FileList | File[] | null,
      options?: { context?: UploadContext<K> },
    ): Promise<UploadedFile[]> => {
      const files = Array.from(input ?? []);
      if (files.length === 0) return [];

      const { accepted, rejected } = validateBatch(files, constraints);
      for (const { file, reason } of rejected) {
        latest.current.onError?.(reason, file);
      }
      if (accepted.length === 0) return [];

      const queued: UploadItem[] = accepted.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        status: "queued",
        progress: 0,
      }));
      if (options?.context !== undefined) {
        for (const item of queued) {
          contexts.current.set(item.id, options.context);
        }
      }
      commit([...itemsRef.current, ...queued]);

      return runBatch(queued);
    },
    [commit, constraints, runBatch],
  );

  /**
   * Re-run a file that failed or was cancelled. Pass an id for one file, or
   * omit it to retry everything retryable.
   */
  const retry = useCallback(
    async (itemId?: string): Promise<UploadedFile[]> => {
      const batch = itemsRef.current.filter(
        (item) =>
          (itemId === undefined || item.id === itemId) &&
          RETRYABLE.includes(item.status),
      );
      if (batch.length === 0) return [];

      const ids = new Set(batch.map((item) => item.id));
      commit(
        itemsRef.current.map((item) =>
          ids.has(item.id)
            ? { ...item, status: "queued", progress: 0, error: undefined }
            : item,
        ),
      );

      return runBatch(batch);
    },
    [commit, runBatch],
  );

  return {
    /** Validate, transfer and finalise a set of files. */
    upload,
    /** Re-run a failed or cancelled file (or all of them). */
    retry,
    /** Per-file state for rendering progress. */
    items,
    isUploading,
    /** True when at least one file can be retried. */
    hasFailures: items.some((item) => RETRYABLE.includes(item.status)),
    /** Cancel one item, or everything in flight. */
    cancel,
    /** Clear the item list (does not touch uploaded files). */
    reset,
    /** The preset's constraints, for helper text and limits in the UI. */
    constraints,
    /** Ready-made `accept` attribute for a file input. */
    accept: acceptAttribute(constraints.accept),
    /** Whether this preset takes more than one file at a time. */
    multiple: constraints.maxFiles > 1,
  };
}

/** SHA-256 of a file, for dedupe. Returns null when it is not worth computing. */
async function hashFile(file: File): Promise<string | undefined> {
  if (file.size > HASH_LIMIT_BYTES) return undefined;
  if (typeof crypto === "undefined" || !crypto.subtle) return undefined;
  try {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      await file.arrayBuffer(),
    );
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // Dedupe is an optimisation; never block an upload on it.
    return undefined;
  }
}

/**
 * `fetch` cannot report upload progress, so the transfer uses XHR. This is the
 * only place in the app that talks to S3 from the browser.
 */
function putToS3(opts: {
  url: string;
  headers: Record<string, string>;
  file: File;
  onProgress: (fraction: number) => void;
  register: (xhr: XMLHttpRequest) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", opts.url, true);
    for (const [name, value] of Object.entries(opts.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        opts.onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            `Transfer to storage failed (${xhr.status}). If this persists, check the bucket's CORS rules.`,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Could not reach storage. Check your connection and the bucket's CORS rules.",
        ),
      );
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    opts.register(xhr);
    xhr.send(opts.file);
  });
}

/** Runs tasks with a fixed number of workers, preserving per-task isolation. */
async function runWithConcurrency<T>(
  tasks: T[],
  limit: number,
  run: (task: T) => Promise<void>,
): Promise<void> {
  const queue = [...tasks];
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, queue.length)) },
    async () => {
      for (;;) {
        const next = queue.shift();
        if (!next) return;
        await run(next);
      }
    },
  );
  await Promise.all(workers);
}

const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Upload failed";
