import { db } from "~/server/db";
import { type ActivityType } from "~Prisma/client";
import { headers } from "next/headers";

import { currentApiRequest } from "~/server/developer-api/request-context";
import { recordActivityUpdate } from "~/server/developer-api/updates";

type ActivityLogData = {
  type: ActivityType;
  action: string;
  details?: Record<string, unknown>;
  userId?: string;
  targetUserId?: string;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Log an activity to the database.
 *
 * During a developer API request the row also names the API key, and every
 * row is offered to the API's update feed, which keeps the ones it has a type
 * for. See `~/server/developer-api/updates`.
 */
export async function logActivity(data: ActivityLogData): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        type: data.type,
        action: data.action,
        details: data.details ? JSON.stringify(data.details) : null,
        userId: data.userId,
        targetUserId: data.targetUserId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        apiKeyId: currentApiRequest()?.keyId ?? undefined,
      },
    });
  } catch (error) {
    // Log error but don't throw - activity logging should not break the main flow
    console.error("Failed to log activity:", error);
  }
  await recordActivityUpdate(data.type, data.details);
}

/**
 * Get request metadata (IP address and user agent) from headers
 */
export async function getRequestMetadata(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  try {
    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      null;
    const userAgent = headersList.get("user-agent") || null;

    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Helper function to log user-related activities
 */
export async function logUserActivity(
  type: ActivityType,
  action: string,
  userId: string,
  targetUserId?: string,
  details?: Record<string, unknown>,
): Promise<void> {
  const metadata = await getRequestMetadata();
  await logActivity({
    type,
    action,
    details,
    userId,
    targetUserId,
    ipAddress: metadata.ipAddress ?? undefined,
    userAgent: metadata.userAgent ?? undefined,
  });
}
