"use client";

import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";

/**
 * Shown at the top of the signed-in layouts while an admin views the site as
 * someone else (see `~/server/impersonation`). Stopping goes back to that
 * user's admin page, signed in as the admin again.
 */
export function ImpersonationBar({
  user,
}: {
  user: { id: string; name: string; email: string };
}) {
  const [pending, setPending] = useState(false);

  async function stop() {
    setPending(true);
    const { error } = await authClient.impersonation.stop();
    if (error) {
      toast.error(error.message ?? "Couldn't stop viewing as this user");
      setPending(false);
      return;
    }
    // A full load, not router.push, so no query cache from the other user survives.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/admin/users/${user.id}`;
  }

  return (
    <div className="relative z-800 bg-amber-500 text-black">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
        <p className="min-w-0 truncate text-sm font-semibold">
          Viewing as {user.name || user.email} ({user.email})
        </p>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto shrink-0"
          disabled={pending}
          onClick={stop}
        >
          Stop viewing
        </Button>
      </div>
    </div>
  );
}
