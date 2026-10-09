import { useRouter } from "expo-router";
import { Alert, ScrollView, View } from "react-native";
import { api } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { Body, Button, Caption, Header, Loading } from "@/components/ui";
import { taskStyles as s } from "@/components/tasks/shared";
export default function Standings() {
  const router = useRouter(),
    { isAdmin } = useStaff(),
    utils = api.useUtils();
  const query = api.tasks.standings.useQuery(undefined, { enabled: isAdmin }),
    rounds = api.tasks.rounds.useQuery(undefined, { enabled: isAdmin });
  const settle = api.tasks.settleRound.useMutation({
    onSuccess: () => {
      void utils.tasks.invalidate();
    },
    onError: (e) => Alert.alert("Could not settle", e.message),
  });
  return (
    <View style={s.page}>
      <Header title="Standings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.content}>
        <Caption>Last 90 days · Alphabetical · Facts, no rank.</Caption>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <Caption style={s.danger}>{query.error.message}</Caption>
        ) : (
          query.data?.map((p) => (
            <View style={s.row} key={p.id}>
              <Body style={s.title}>{p.name}</Body>
              <Caption>
                {p.open} open · {p.overdue} overdue · {p.onTime} on time
              </Caption>
              <Caption>
                {p.lateFlagged} late, flagged · {p.silentMisses} silent misses
              </Caption>
              <Caption>
                {p.rescues} rescues · {p.earlyDelays} early delays ·{" "}
                {p.roundsOwed} rounds owed
              </Caption>
            </View>
          ))
        )}
        {rounds.data
          ?.filter((r) => !r.settledAt && !r.waivedAt)
          .map((r) => (
            <View style={s.row} key={r.id}>
              <Body>
                {r.owedBy.name} owes {r.owedTo?.name ?? "the team"}
              </Body>
              <Caption>{r.task.title}</Caption>
              <Button
                variant="outline"
                disabled={settle.isPending}
                onPress={() => settle.mutate({ id: r.id })}
              >
                Settle round
              </Button>
            </View>
          ))}
      </ScrollView>
    </View>
  );
}
