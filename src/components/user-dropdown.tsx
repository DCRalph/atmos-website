"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import {
  ChevronUp,
  ChevronDown,
  Home,
  LogOut,
  Sun,
  Moon,
  Computer,
  Check,
  Shield,
  LayoutDashboard,
  Settings2,
  LogIn,
  UserPlus,
  ExternalLink,
  Edit,
} from "lucide-react";
import Link from "next/link";
import UserAvatar from "~/components/UserAvatar";
import { authClient } from "~/lib/auth-client";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

import { api } from "~/trpc/react";

export function UserDropdown({ detailed = false }) {
  // const { data: session } = authClient.useSession();
  const { data: user, isLoading: userLoading } = api.user.me.useQuery();
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div
          className={cn(
            `hover:bg-foreground/10 flex cursor-pointer items-center justify-center gap-3 rounded-md p-2 transition-colors duration-200`,
          )}
        >
          <UserAvatar
            src={user?.image ?? null}
            name={user?.name ?? user?.email}
            className="h-8 w-8"
          />
          {detailed && (
            <div className="hidden flex-col overflow-hidden md:flex">
              {userLoading ? (
                <p className="text-foreground truncate text-sm font-medium">
                  Loading...
                </p>
              ) : user && !userLoading ? (
                <>
                  <p className="text-foreground truncate text-sm font-medium">
                    {user.name}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </p>
                </>
              ) : (
                <p className="text-foreground truncate text-sm font-medium">
                  Guest
                </p>
              )}
            </div>
          )}
          {detailed && (
            <div className="hidden flex-1 overflow-hidden md:flex">
              {open ? (
                <ChevronUp className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              )}
            </div>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={"end"} className="w-56">
        {user ? (
          <>
            <DropdownMenuLabel className="flex items-center gap-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-foreground truncate text-sm font-medium">
                  {user.name ?? user.email ?? "Signed in"}
                </span>
                {user.email && (
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                )}
                {user.role === "ADMIN" && (
                  <span className="text-primary mt-1 flex items-center gap-1 text-xs font-medium">
                    <Shield className="size-3" />
                    Admin
                  </span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-muted-foreground px-2 py-2 text-xs font-semibold tracking-wider uppercase">
              Navigation
            </DropdownMenuLabel>

            <DropdownMenuItem asChild>
              <Link href="/" className="flex items-center gap-3 py-2">
                <Home className="text-muted-foreground size-4" />
                <span>Home</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href="/dashboard" className="flex items-center gap-3 py-2">
                <LayoutDashboard className="text-muted-foreground size-4" />
                <span>Dashboard</span>
              </Link>
            </DropdownMenuItem>

            {user?.role === "ADMIN" && (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="flex items-center gap-3 py-2">
                    <Settings2 className="text-muted-foreground size-4" />
                    <span>Admin Dashboard</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
              </>
            )}

            {/* TODO: Implement account settings page */}
            <DropdownMenuItem asChild>
              <Link
                href="/account-settings"
                className="flex items-center gap-3 py-2"
              >
                <Settings2 className="text-muted-foreground size-4" />
                <span>Account Settings</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-3 py-2">
                {mounted && (
                  <>
                    {theme === "light" && (
                      <Sun className="text-muted-foreground size-4" />
                    )}
                    {theme === "dark" && (
                      <Moon className="text-muted-foreground size-4" />
                    )}
                    {theme === "system" && (
                      <Computer className="text-muted-foreground size-4" />
                    )}
                  </>
                )}
                <span>Theme</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="mr-2 size-4" />
                  Light
                  {theme === "light" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="mr-2 size-4" />
                  Dark
                  {theme === "dark" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Computer className="mr-2 size-4" />
                  System
                  {theme === "system" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuItem variant="destructive">
              <LogOut className="text-muted-foreground size-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuLabel className="flex items-center gap-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-foreground truncate text-sm font-medium">
                  Guest
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  Not signed in
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-muted-foreground px-2 py-2 text-xs font-semibold tracking-wider uppercase">
              Navigation
            </DropdownMenuLabel>

            <DropdownMenuItem asChild>
              <Link
                href="/"
                className="flex w-full cursor-pointer items-center"
              >
                <Home className="mr-2 h-4 w-4" />
                Home
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/signin" className="flex items-center gap-3 py-2">
                <LogIn className="text-muted-foreground size-4" />
                <span>Sign In</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href="/signup" className="flex items-center gap-3 py-2">
                <UserPlus className="text-muted-foreground size-4" />
                <span>Sign Up</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-3 py-2">
                {mounted && (
                  <>
                    {theme === "light" && (
                      <Sun className="text-muted-foreground size-4" />
                    )}
                    {theme === "dark" && (
                      <Moon className="text-muted-foreground size-4" />
                    )}
                    {theme === "system" && (
                      <Computer className="text-muted-foreground size-4" />
                    )}
                  </>
                )}
                <span>Theme</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="mr-2 size-4" />
                  Light
                  {theme === "light" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="mr-2 size-4" />
                  Dark
                  {theme === "dark" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Computer className="mr-2 size-4" />
                  System
                  {theme === "system" && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
