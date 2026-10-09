import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { z } from "zod";
import { useStaff } from "@/lib/staff";
const native = requireOptionalNativeModule<{
  pendingTaskShare?: () => Promise<string | null>;
  clearTaskShare?: () => Promise<void>;
}>("RunSheetActivity");
const schema = z.object({
  text: z.string().max(30000),
  images: z
    .array(
      z.object({
        uri: z.string().startsWith("file://"),
        name: z.string(),
        type: z.literal("image/jpeg"),
      }),
    )
    .max(5),
});
export function usePendingTaskShare() {
  const { isAdmin } = useStaff();
  const [pending, setPending] = useState<z.infer<typeof schema> | null>(null);
  useEffect(() => {
    if (!isAdmin) {
      setPending(null);
      return;
    }
    const read = async () => {
      const json = await native?.pendingTaskShare?.();
      if (json) {
        const parsed = schema.safeParse(JSON.parse(json));
        setPending(parsed.success ? parsed.data : null);
      }
    };
    void read().catch(() => undefined);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void read().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [isAdmin]);
  return {
    pending,
    clear: () => {
      setPending(null);
      void native?.clearTaskShare?.().catch(() => undefined);
    },
  };
}
