import { useState } from "react";
import { useRouter } from "expo-router";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { api } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { colors } from "@/lib/theme";
import {
  Body,
  Button,
  Caption,
  Eyebrow,
  Header,
  Loading,
} from "@/components/ui";
import { taskStyles as s } from "@/components/tasks/shared";
import { dayKey, formatTaskDate } from "~/lib/tasks/time";
import { statusLabels } from "~/lib/tasks/status";
export default function TasksAgenda() {
  const router = useRouter(),
    utils = api.useUtils();
  const { isAdmin } = useStaff();
  const [mine, setMine] = useState(true);
  const query = api.tasks.list.useQuery(undefined, {
      enabled: isAdmin,
      refetchInterval: 60_000,
    }),
    options = api.tasks.options.useQuery(undefined, { enabled: isAdmin }),
    alerts = api.tasks.alerts.useQuery(undefined, {
      enabled: isAdmin,
      refetchInterval: 60_000,
    });
  const take = api.tasks.take.useMutation({
    onSuccess: () => {
      void utils.tasks.invalidate();
    },
    onError: (e) => Alert.alert("Could not take task", e.message),
  });
  const tasks = (query.data ?? [])
    .filter(
      (t) =>
        !mine ||
        t.assigneeId === options.data?.userId ||
        t.reviewerId === options.data?.userId,
    )
    .sort((a, b) => a.projectedDueAt.getTime() - b.projectedDueAt.getTime());
  const groups = [
    ...new Set(
      tasks.map((t) =>
        t.status === "PROPOSED"
          ? "Proposed"
          : t.waiting
            ? "Waiting on someone"
            : t.status === "BLOCKED"
              ? "Blocked"
              : t.status === "IN_REVIEW"
                ? "In review"
                : t.overdue
                  ? "Overdue"
                  : dayKey(t.projectedDueAt),
      ),
    ),
  ];
  return (
    <View style={s.page}>
      <Header
        title="Tasks"
        onBack={() => router.back()}
        right={
          <Button variant="outline" onPress={() => router.push("/tasks/new")}>
            Add
          </Button>
        }
      />
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            tintColor={colors.accent}
            refreshing={query.isRefetching}
            onRefresh={() => {
              void utils.tasks.invalidate();
            }}
          />
        }
      >
        <View style={s.buttons}>
          <Button
            variant={mine ? "accent" : "outline"}
            onPress={() => setMine(true)}
          >
            Mine
          </Button>
          <Button
            variant={!mine ? "accent" : "outline"}
            onPress={() => setMine(false)}
          >
            Everyone
          </Button>
          <Button
            variant="outline"
            onPress={() => router.push("/tasks/standings")}
          >
            Standings
          </Button>
        </View>
        {!mine && alerts.data?.length ? (
          <View style={s.section}>
            <Eyebrow>Needs a hand</Eyebrow>
            {alerts.data.map((t) => (
              <View key={t.id} style={s.row}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/tasks/[taskId]",
                      params: { taskId: t.id },
                    })
                  }
                >
                  <Body>{t.title}</Body>
                  <Caption style={{ color: colors.danger }}>
                    {t.atRisk
                      ? "At risk"
                      : t.unassigned
                        ? "Unassigned"
                        : t.escalated
                          ? "Escalated"
                          : "Overdue"}{" "}
                    · {t.assignee?.name ?? "No owner"} ·{" "}
                    {t.flagged ? "Flagged" : "No delay reported"}
                  </Caption>
                </Pressable>
                {t.status !== "IN_REVIEW" &&
                !t.waiting &&
                t.assigneeId !== options.data?.userId ? (
                  <Button
                    variant="outline"
                    disabled={take.isPending}
                    onPress={() => take.mutate({ id: t.id })}
                  >
                    Take it
                  </Button>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <Caption style={s.danger}>{query.error.message}</Caption>
        ) : !tasks.length ? (
          <Body>No tasks here. Add one or paste a chat.</Body>
        ) : (
          groups.map((group) => (
            <View key={group} style={s.section}>
              <Eyebrow>{group}</Eyebrow>
              {tasks
                .filter(
                  (t) =>
                    (t.status === "PROPOSED"
                      ? "Proposed"
                      : t.waiting
                        ? "Waiting on someone"
                        : t.status === "BLOCKED"
                          ? "Blocked"
                          : t.status === "IN_REVIEW"
                            ? "In review"
                            : t.overdue
                              ? "Overdue"
                              : dayKey(t.projectedDueAt)) === group,
                )
                .map((t) => (
                  <Pressable
                    key={t.id}
                    accessibilityRole="button"
                    style={s.row}
                    onPress={() =>
                      router.push({
                        pathname: "/tasks/[taskId]",
                        params: { taskId: t.id },
                      })
                    }
                  >
                    <Text style={s.title}>
                      {t.critical ? "! " : ""}
                      {t.title}
                    </Text>
                    <Caption>
                      {t.assignee?.name ?? "Unassigned"} ·{" "}
                      {statusLabels[t.status]}
                      {t.upForGrabs ? " · Up for grabs" : ""}
                    </Caption>
                    <Caption
                      style={t.overdue || t.atRisk ? s.danger : undefined}
                    >
                      {formatTaskDate(t.projectedDueAt)}
                      {t.projectedDueAt.getTime() !== t.dueAt.getTime()
                        ? ` · Projected, was ${formatTaskDate(t.dueAt)}`
                        : ""}
                    </Caption>
                  </Pressable>
                ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
