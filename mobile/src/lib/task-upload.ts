import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "~/server/api/root";
/** Bytes use the existing presigned upload path; sessions stay in the app. */
export async function uploadTaskImage(
  client: TRPCClient<AppRouter>,
  uri: string,
  name: string,
  type: string,
  taskId?: string,
) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const upload = await client.uploads.start.mutate({
    preset: taskId ? "taskProof" : "mediaLibrary",
    ...(taskId ? { context: { taskId } } : {}),
    file: { name, type, size: blob.size },
  });
  if (upload.status === "duplicate") return upload.file.id;
  try {
    const put = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.headers,
      body: blob,
    });
    if (!put.ok) throw new Error("Photo upload failed");
    const file = await client.uploads.finish.mutate({
      uploadId: upload.uploadId,
    });
    return file.id;
  } catch (error) {
    await client.uploads.abort
      .mutate({ uploadId: upload.uploadId })
      .catch(() => undefined);
    throw error;
  }
}
