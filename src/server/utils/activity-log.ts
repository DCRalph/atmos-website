import { db } from "~/server/db";
import { type ActivityType } from "~Prisma/client";
import { headers } from "next/headers";

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
 * Log an activity to the database
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
      },
    });
  } catch (error) {
    // Log error but don't throw - activity logging should not break the main flow
    console.error("Failed to log activity:", error);
  }
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
