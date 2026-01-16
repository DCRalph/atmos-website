import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { getS3ObjectStream } from "~/lib/s3Helper";
import { FileUploadStatus } from "~Prisma/client";
import { ObjectCannedACL } from "@aws-sdk/client-s3";

// 1 year in seconds
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
  }

  try {
    // const { stream, contentType, contentLength, lastModified, eTag } =
    //   await getS3FromDbId(id);

    const record = await db.file_upload.findUnique({
      where: {
        id,
        status: FileUploadStatus.OK,
        // for: "gig_media",
        // acl: ObjectCannedACL.public_read
      },
      select: {
        key: true,
      },
    });
    if (!record) throw new Error("File not found");
    const { stream, contentType, contentLength, lastModified, eTag } =
      await getS3ObjectStream(record.key);

    // Convert Node.js stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        stream.on("end", () => {
          controller.close();
        });
        stream.on("error", (err) => {
          controller.error(err);
        });
      },
    });

    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
    });

    if (contentLength !== undefined) {
      headers.set("Content-Length", String(contentLength));
    }
    if (lastModified) {
      headers.set("Last-Modified", lastModified);
    }
    if (eTag) {
      headers.set("ETag", eTag);
    }

    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error fetching media:", error);

    if (error instanceof Error && error.message === "File not found") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to fetch media" },
      { status: 500 },
    );
  }
}
