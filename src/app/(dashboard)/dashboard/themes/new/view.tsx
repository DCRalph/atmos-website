"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

/**
 * Creates a new empty theme for the caller, then redirects into the editor.
 */
export function NewThemeView() {
  const router = useRouter();
  const createMut = api.creatorThemes.create.useMutation({
    onSuccess: (created) => {
      router.replace(`/dashboard/themes/${created.id}`);
    },
  });
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    createMut.mutate({ name: "New theme" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-muted-foreground flex min-h-dvh items-center justify-center gap-2 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      {createMut.error ? createMut.error.message : "Creating theme..."}
    </div>
  );
}
