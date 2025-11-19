"use client";

import { useState, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

type UserIndicatorProps = {
  variant?: "light" | "black";
};

export function UserIndicator({ variant = "light" }: UserIndicatorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isAboutPage = pathname === "/about";
  variant = isAboutPage ? "black" : variant;

  const { data: user } = api.user.me.useQuery();
  const [open, setOpen] = useState(false);
  const isBlackMode = variant === "black";

  const displayName = useMemo(
    () => user?.name ?? user?.email ?? "Account",
    [user?.name, user?.email]
  );


  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          setOpen(false);
          router.refresh();
        },
      },
    });
  };

  // return null

  if (!user) {
    return (
      <></>
    );
  }

  return (
    <div className="fixed right-3 top-3 z-20 ">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium shadow-glass! bg-background/70 backdrop-blur-md transition-colors",

            )}
            aria-label="Open account menu"
          >
            <span className="max-w-[110px] truncate">{displayName}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-56 rounded-xl border border-border/70 bg-background/95 p-2 shadow-xl backdrop-blur"
        >
          <div className="flex items-center gap-2.5 px-2">
            {/* <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[0.6rem] font-semibold uppercase text-primary">
              {initials || "U"}
            </div> */}
            <div className="flex min-w-0 flex-col">
              <p className="truncate font-medium">
                {user.name || "Signed in"}
              </p>
              {user.email && (
                <p className="truncate text-[0.65rem] text-muted-foreground">
                  {user.email}
                </p>
              )}
            </div>
          </div>

          <div className="my-2 h-px bg-border/70" />

          <div className="flex flex-col gap-1">
            <Link href="/">
              <Button
                variant="ghost"
                className="w-full justify-between"
              >
                <span>Home</span>
              </Button>
            </Link>

            {user.role === "ADMIN" && (
              <Link href="/admin">
                <Button
                  variant="ghost"
                  className="w-full justify-between"
                >
                  <span>Admin Panel</span>
                  {/* <span className="rounded-full bg-red-500/10 px-1.5 py-px text-[0.55rem] font-semibold text-red-500">
                  Panel
                </span> */}
                </Button>
              </Link>
            )}

            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
            >
              Log out
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}