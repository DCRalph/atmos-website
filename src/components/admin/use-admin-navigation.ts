"use client";

import { useMemo } from "react";

import { api } from "~/trpc/react";
import { adminNavigationGroups } from "./admin-navigation";

/**
 * The admin navigation this viewer should see: superadmin-only items are
 * dropped for everyone else, and so is any group left empty.
 *
 * Until `user.me` loads, superadmin items stay hidden rather than flashing in.
 */
export function useAdminNavigation() {
  const me = api.user.me.useQuery();
  const isSuperadmin =
    me.data?.effectivePermissions.includes("SUPERADMIN") ?? false;

  return useMemo(() => {
    const groups = adminNavigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !item.superadminOnly || isSuperadmin,
        ),
      }))
      .filter((group) => group.items.length > 0);
    return { groups, items: groups.flatMap((group) => group.items) };
  }, [isSuperadmin]);
}
