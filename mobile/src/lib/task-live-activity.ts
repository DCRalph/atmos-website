import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { taskDayActivity } from "~/lib/tasks/live-activity";
import { api } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { useAuth } from "@/lib/auth";
import { isLiveActivitySupported } from "@/lib/live-activity";
const native = requireOptionalNativeModule<{
  applyTasks?: (json: string) => Promise<boolean>;
  setTaskUser?: (id: string | null) => Promise<void>;
  endTasks?: () => Promise<void>;
}>("RunSheetActivity");
export function useTaskLiveActivity() {
  const { user } = useAuth(),
    { isAdmin } = useStaff();
  const enabled = isAdmin && isLiveActivitySupported();
  const tasks = api.tasks.list.useQuery(undefined, {
    enabled,
    retry: false,
    refetchInterval: 5 * 60_000,
  });
  const last = useRef<string | null>(null);
  useEffect(() => {
    void native
      ?.setTaskUser?.(enabled ? (user?.id ?? null) : null)
      .catch(() => undefined);
    last.current = null;
  }, [enabled, user?.id]);
  useEffect(() => {
    if (!enabled || !user) {
      void native?.endTasks?.().catch(() => undefined);
      return;
    }
    const sync = () => {
      if (!tasks.data || AppState.currentState !== "active") return;
      const payload = taskDayActivity(
        user.id,
        tasks.data
          .filter((t) => t.assigneeId === user.id)
          .map((t) => ({ ...t, dueAt: t.projectedDueAt })),
        new Date(),
      );
      const json = JSON.stringify(payload);
      if (json === last.current) return;
      void native
        ?.applyTasks?.(json)
        .then((applied) => {
          if (applied) last.current = json;
        })
        .catch(() => undefined);
    };
    sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        last.current = null;
        void tasks.refetch();
        sync();
      }
    });
    const timer = setInterval(sync, 60_000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [enabled, user, tasks.data]);
}
