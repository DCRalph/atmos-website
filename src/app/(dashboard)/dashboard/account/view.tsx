"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";

import { api, type RouterOutputs } from "~/trpc/react";
import { authClient } from "~/lib/auth-client";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { useConfirm } from "~/components/confirm-provider";
import { SessionsTable } from "~/components/account/sessions-table";
import { SignInMethodRow } from "~/components/account/sign-in-method-row";

type Security = RouterOutputs["user"]["security"];

/** Providers a person can link from the website. Apple is native only. */
const WEB_PROVIDERS = ["google"] as const;

export function AccountView() {
  const { data: me } = api.user.me.useQuery();
  const { data: security, isLoading } = api.user.security.useQuery();

  return (
    <div className="bg-background min-h-dvh px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Account</h1>
        </div>

        {me && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="font-medium">{me.name}</span>
            <span className="text-muted-foreground text-sm">{me.email}</span>
            {me.emailVerified ? (
              <Badge variant="outline" className="text-xs text-green-600">
                <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
                Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                <XCircle className="mr-1 h-3 w-3" aria-hidden />
                Unverified
              </Badge>
            )}
          </div>
        )}

        {isLoading || !security ? (
          <div className="flex items-center justify-center py-12">
            <Loader2
              className="text-muted-foreground h-8 w-8 animate-spin"
              aria-hidden
            />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <PasswordCard security={security} />
            <ConnectedAccountsCard security={security} />
            <div className="lg:col-span-2">
              <SessionsCard security={security} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordCard({ security }: { security: Security }) {
  const confirm = useConfirm();
  const utils = api.useUtils();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(false);

  const reset = async () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    await utils.user.security.invalidate();
  };
  const changePassword = api.user.changePassword.useMutation({
    onSuccess: async () => {
      toast.success("Password changed");
      await reset();
    },
    onError: (error) => toast.error(error.message),
  });
  const setPassword = api.user.setPassword.useMutation({
    onSuccess: async () => {
      toast.success("Password added");
      await reset();
    },
    onError: (error) => toast.error(error.message),
  });
  const unlink = api.user.unlinkAccount.useMutation({
    onSuccess: async () => {
      toast.success("Password removed");
      await utils.user.security.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const passwordAccount = security.accounts.find(
    (row) => row.providerId === "credential",
  );
  const mismatch = confirmPassword !== "" && confirmPassword !== newPassword;
  const ready =
    newPassword.length >= 8 &&
    newPassword === confirmPassword &&
    (!security.hasPassword || currentPassword !== "");
  const pending = changePassword.isPending || setPassword.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {security.hasPassword ? "Password" : "Add a password"}
        </CardTitle>
        <CardDescription>
          {security.hasPassword
            ? "Change the password you sign in with."
            : "You sign in with a linked account. Add a password to also sign in with your email."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {security.hasPassword && (
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-invalid={mismatch}
          />
          {mismatch && (
            <p className="text-destructive text-xs">
              Passwords don&apos;t match
            </p>
          )}
        </div>

        {security.hasPassword && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={revokeOthers}
              onCheckedChange={(value) => setRevokeOthers(Boolean(value))}
            />
            Sign out other devices
          </label>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            disabled={!ready || pending}
            onClick={() =>
              security.hasPassword
                ? changePassword.mutate({
                    currentPassword,
                    newPassword,
                    revokeOtherSessions: revokeOthers,
                  })
                : setPassword.mutate({ newPassword })
            }
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {security.hasPassword ? "Change password" : "Add password"}
          </Button>

          {passwordAccount && (
            <Button
              variant="ghost"
              disabled={unlink.isPending || security.accounts.length === 1}
              title={
                security.accounts.length === 1
                  ? "Connect another way to sign in first"
                  : undefined
              }
              onClick={async () => {
                const ok = await confirm({
                  title: "Remove password?",
                  description:
                    "You'll only be able to sign in with your connected accounts.",
                  confirmLabel: "Remove",
                  variant: "destructive",
                });
                if (ok) unlink.mutate({ accountId: passwordAccount.id });
              }}
            >
              Remove password
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectedAccountsCard({ security }: { security: Security }) {
  const confirm = useConfirm();
  const utils = api.useUtils();
  const [linking, setLinking] = useState(false);
  const unlink = api.user.unlinkAccount.useMutation({
    onSuccess: async () => {
      toast.success("Account disconnected");
      await utils.user.security.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const byProvider = new Map(
    security.accounts.map((row) => [row.providerId, row] as const),
  );
  const onlyMethod = security.accounts.length === 1;

  const disconnect = (providerId: string) => {
    const account = byProvider.get(providerId);
    if (!account) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={unlink.isPending || onlyMethod}
        title={onlyMethod ? "Add another way to sign in first" : undefined}
        onClick={async () => {
          const ok = await confirm({
            title: "Disconnect account?",
            description: "You'll no longer be able to sign in this way.",
            confirmLabel: "Disconnect",
            variant: "destructive",
          });
          if (ok) unlink.mutate({ accountId: account.id });
        }}
      >
        Disconnect
      </Button>
    );
  };

  const link = async (provider: (typeof WEB_PROVIDERS)[number]) => {
    setLinking(true);
    try {
      await authClient.linkSocial({
        provider,
        callbackURL: "/dashboard/account",
      });
    } catch {
      toast.error("Couldn't start linking. Try again.");
      setLinking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription>
          Sign in with any of these. You need at least one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {WEB_PROVIDERS.map((provider) => (
          <SignInMethodRow
            key={provider}
            providerId={provider}
            connectedAt={byProvider.get(provider)?.createdAt}
            action={
              disconnect(provider) ?? (
                <Button
                  size="sm"
                  disabled={linking}
                  onClick={() => link(provider)}
                >
                  {linking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Connect
                </Button>
              )
            }
          />
        ))}
        <SignInMethodRow
          providerId="apple"
          connectedAt={byProvider.get("apple")?.createdAt}
          detail={
            byProvider.has("apple")
              ? undefined
              : "Connect from the Atmos iOS app"
          }
          action={disconnect("apple")}
        />
        <SignInMethodRow
          providerId="credential"
          connectedAt={byProvider.get("credential")?.createdAt}
          detail={security.hasPassword ? undefined : "Not set"}
        />
      </CardContent>
    </Card>
  );
}

function SessionsCard({ security }: { security: Security }) {
  const confirm = useConfirm();
  const utils = api.useUtils();
  const revokeOne = api.user.revokeSession.useMutation({
    onSuccess: () => utils.user.security.invalidate(),
    onError: (error) => toast.error(error.message),
  });
  const revokeOthers = api.user.revokeOtherSessions.useMutation({
    onSuccess: async (result) => {
      toast.success(
        result.count === 1
          ? "Signed out 1 other device"
          : `Signed out ${result.count} other devices`,
      );
      await utils.user.security.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const others = security.sessions.filter((row) => !row.isCurrent).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Where you&apos;re signed in</CardTitle>
          <CardDescription>
            Sign out anywhere you don&apos;t recognise.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={revokeOthers.isPending || others === 0}
          onClick={async () => {
            const ok = await confirm({
              title: "Sign out other devices?",
              description: "This device stays signed in.",
              confirmLabel: "Sign out",
            });
            if (ok) revokeOthers.mutate();
          }}
        >
          Sign out other devices
        </Button>
      </CardHeader>
      <CardContent>
        <SessionsTable
          sessions={security.sessions}
          storageKey="account-sessions"
          isRevoking={revokeOne.isPending}
          onRevoke={(sessionId) => revokeOne.mutate({ sessionId })}
        />
      </CardContent>
    </Card>
  );
}
