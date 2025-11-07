"use client";

import { useState } from "react";
import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { useRouter } from "next/navigation";

export function UserIndicator() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [isOpen, setIsOpen] = useState(false);

  if (isPending) {
    return null;
  }

  if (!session?.user) {
    return null;
  }

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          setIsOpen(false);
          router.refresh();
        },
      },
    });
  };

  return (
    <div className="fixed left-1/2 top-4 -translate-x-1/2 z-30">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="bg-black/50 backdrop-blur-sm border-white/20 text-white hover:bg-black/70"
          >
            <div className="flex items-center gap-2">
              {/* <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold">
                {userInitial}
              </div> */}
              <span>{session.user.name ?? session.user.email}</span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-56 bg-background">
          <div className="flex flex-col space-y-3">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{session.user.name}</p>
              <p className="text-xs text-muted-foreground">{session.user.email}</p>
            </div>
            <div className="h-px bg-border" />
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              Log out
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

