"use client";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatDateInUserTimezone } from "~/lib/date-utils";
import { Badge } from "~/components/ui/badge";
import {
  Activity,
  User,
  Shield,
  Ban,
  Unlock,
  UserCog,
  Trash2,
  Mail,
  Calendar,
  Clock,
  Loader2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { ActivityType } from "~/lib/activity-types";

function getActivityTypeBadge(type: ActivityType) {
  const typeMap: Record<ActivityType, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    USER_CREATED: { label: "User Created", variant: "default" },
    USER_UPDATED: { label: "User Updated", variant: "secondary" },
    USER_DELETED: { label: "User Deleted", variant: "destructive" },
    USER_ROLE_CHANGED: { label: "Role Changed", variant: "outline" },
    USER_BANNED: { label: "User Banned", variant: "destructive" },
    USER_UNBANNED: { label: "User Unbanned", variant: "secondary" },
    USER_IMPERSONATED: { label: "User Impersonated", variant: "outline" },
    INVITE_CREATED: { label: "Invite Created", variant: "default" },
    INVITE_DELETED: { label: "Invite Deleted", variant: "secondary" },
    GIG_CREATED: { label: "Gig Created", variant: "default" },
    GIG_UPDATED: { label: "Gig Updated", variant: "secondary" },
    GIG_DELETED: { label: "Gig Deleted", variant: "destructive" },
    CONTENT_CREATED: { label: "Content Created", variant: "default" },
    CONTENT_UPDATED: { label: "Content Updated", variant: "secondary" },
    CONTENT_DELETED: { label: "Content Deleted", variant: "destructive" },
    CREW_MEMBER_CREATED: { label: "Crew Created", variant: "default" },
    CREW_MEMBER_UPDATED: { label: "Crew Updated", variant: "secondary" },
    CREW_MEMBER_DELETED: { label: "Crew Deleted", variant: "destructive" },
    FILE_UPLOADED: { label: "File Uploaded", variant: "default" },
    FILE_DELETED: { label: "File Deleted", variant: "destructive" },
    LOGIN: { label: "Login", variant: "default" },
    LOGOUT: { label: "Logout", variant: "secondary" },
    OTHER: { label: "Other", variant: "outline" },
  };

  const config = typeMap[type] ?? { label: type, variant: "outline" as const };

  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  );
}

function getActivityIcon(type: ActivityType) {
  const iconMap: Record<ActivityType, typeof User> = {
    USER_CREATED: User,
    USER_UPDATED: UserCog,
    USER_DELETED: Trash2,
    USER_ROLE_CHANGED: Shield,
    USER_BANNED: Ban,
    USER_UNBANNED: Unlock,
    USER_IMPERSONATED: Shield,
    INVITE_CREATED: Mail,
    INVITE_DELETED: Trash2,
    GIG_CREATED: Calendar,
    GIG_UPDATED: Calendar,
    GIG_DELETED: Trash2,
    CONTENT_CREATED: Calendar,
    CONTENT_UPDATED: Calendar,
    CONTENT_DELETED: Trash2,
    CREW_MEMBER_CREATED: User,
    CREW_MEMBER_UPDATED: UserCog,
    CREW_MEMBER_DELETED: Trash2,
    FILE_UPLOADED: Calendar,
    FILE_DELETED: Trash2,
    LOGIN: User,
    LOGOUT: User,
    OTHER: Activity,
  };

  return iconMap[type] ?? Activity;
}

type UserActivityLogsProps = {
  userId: string;
};

export function UserActivityLogs({ userId }: UserActivityLogsProps) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.activityLogs.getByUser.useInfiniteQuery(
      {
        userId,
        limit: 50,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    );

  const logs = data?.pages.flatMap((page) => page.logs) ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            User Activity Logs
          </CardTitle>
          <CardDescription>
            Activities performed by or affecting this user
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`loading-log-${i}`}>
                      <TableCell colSpan={5}>
                        <div className="bg-muted h-8 w-full animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                : logs.map((log) => {
                    const Icon = getActivityIcon(log.type as ActivityType);
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {getActivityTypeBadge(log.type as ActivityType)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            <p className="text-sm font-medium">{log.action}</p>
                            {log.details && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                {JSON.stringify(log.details)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.user ? (
                            <Link
                              href={`/admin/users/${log.user.id}`}
                              className="flex items-center gap-2 hover:underline"
                            >
                              {log.user.image ? (
                                <img
                                  src={log.user.image}
                                  alt={log.user.name}
                                  className="h-6 w-6 rounded-full"
                                />
                              ) : (
                                <div className="bg-muted flex h-6 w-6 items-center justify-center rounded-full">
                                  <User className="h-3 w-3" />
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium">{log.user.name}</p>
                                <p className="text-muted-foreground text-xs">{log.user.email}</p>
                              </div>
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-sm">System</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDateInUserTimezone(log.createdAt, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              year: "numeric",
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground text-xs font-mono">
                            {log.ipAddress ?? "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              {!isLoading && logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center py-8">
                    No activity logs found for this user
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Load More Button */}
        {hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Load More
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
