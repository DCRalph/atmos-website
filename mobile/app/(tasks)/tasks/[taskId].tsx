import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import {
  Body,
  Button,
  Caption,
  Eyebrow,
  Header,
  Loading,
} from "@/components/ui";
import {
  TaskChoices,
  TaskInput,
  dateText,
  parseTaskDate,
  taskStyles as s,
} from "@/components/tasks/shared";
import { formatTaskDate } from "~/lib/tasks/time";
import { statusActions, statusLabels, isOpen } from "~/lib/tasks/status";
import { uploadTaskImage } from "@/lib/task-upload";
export default function TaskDetail() {
  const params = useLocalSearchParams<{ taskId: string; action?: string }>(),
    router = useRouter(),
    utils = api.useUtils(),
    { isAdmin } = useStaff();
  const id = params.taskId;
  const query = api.tasks.get.useQuery({ id }, { enabled: isAdmin }),
    options = api.tasks.options.useQuery(undefined, { enabled: isAdmin }),
    all = api.tasks.list.useQuery(undefined, { enabled: isAdmin });
  const [mode, setMode] = useState<
      "delay" | "blocked" | "offer" | "return" | null
    >(params.action === "delay" ? "delay" : null),
    [body, setBody] = useState(""),
    [date, setDate] = useState(dateText(new Date(Date.now() + 86400_000))),
    [comment, setComment] = useState(""),
    [onBehalf, setOnBehalf] = useState(false),
    [owner, setOwner] = useState(""),
    [dep, setDep] = useState(""),
    [gap, setGap] = useState(""),
    [uploading, setUploading] = useState(false),
    [edit, setEdit] = useState(false),
    [title, setTitle] = useState(""),
    [notes, setNotes] = useState(""),
    [reviewer, setReviewer] = useState(""),
    [gig, setGig] = useState(""),
    [critical, setCritical] = useState(false),
    [proofRequired, setProofRequired] = useState(false);
  const [acceptDate, setAcceptDate] = useState<string>();
  const acceptedDue = parseTaskDate(
    acceptDate ?? (query.data ? dateText(query.data.dueAt) : date),
  );
  const due = parseTaskDate(date);
  const impact = api.tasks.impact.useQuery(
      { id, dueAt: due ?? new Date(0) },
      { enabled: isAdmin && !!due && (mode === "delay" || edit) },
    ),
    suggest = api.tasks.suggestGap.useQuery(
      { id, dependsOnId: dep },
      { enabled: isAdmin && !!dep },
    );
  const onSuccess = () => {
    void utils.tasks.invalidate();
    setMode(null);
    setBody("");
  };
  const onError = (e: { message: string }) =>
    Alert.alert("Could not update task", e.message);
  const cb = { onSuccess, onError };
  const status = api.tasks.setStatus.useMutation(cb),
    delay = api.tasks.reportDelay.useMutation(cb),
    offer = api.tasks.offer.useMutation(cb),
    take = api.tasks.take.useMutation(cb),
    accept = api.tasks.accept.useMutation(cb),
    dismiss = api.tasks.dismiss.useMutation(cb),
    post = api.tasks.comment.useMutation({
      ...cb,
      onSuccess: () => {
        onSuccess();
        setComment("");
      },
    }),
    add = api.tasks.addDependency.useMutation({
      ...cb,
      onSuccess: () => {
        onSuccess();
        setDep("");
      },
    }),
    remove = api.tasks.removeDependency.useMutation(cb),
    proof = api.tasks.attachProof.useMutation(cb),
    assess = api.tasks.assessProof.useMutation(cb),
    triage = api.tasks.triage.useMutation({ onError }),
    update = api.tasks.update.useMutation({
      ...cb,
      onSuccess: () => {
        onSuccess();
        setEdit(false);
      },
    });
  const t = query.data;
  const handledDone = useRef<string | null>(null);
  useEffect(() => {
    if (
      params.action !== "done" ||
      !t ||
      !options.data?.userId ||
      handledDone.current === id
    )
      return;
    handledDone.current = id;
    // The notification action is explicit intent, executed only after the route's admin and biometric gates.
    const action = statusActions(t, options.data.userId).find(
      (rule) => rule.to === "DONE" || rule.to === "IN_REVIEW",
    );
    if (action) status.mutate({ id, status: action.to });
    else
      Alert.alert(
        "Task changed",
        "Open the task's current actions to finish it.",
      );
    router.setParams({ action: undefined });
  }, [params.action, t, options.data?.userId, id, status, router]);
  const busy =
    status.isPending ||
    delay.isPending ||
    offer.isPending ||
    take.isPending ||
    accept.isPending ||
    dismiss.isPending;
  const pickProof = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const a = result.assets[0]!;
      const uploadId = await uploadTaskImage(
        utils.client,
        a.uri,
        a.fileName ?? "proof.jpg",
        a.mimeType ?? "image/jpeg",
        id,
      );
      await proof.mutateAsync({ id, uploadId });
    } catch (error) {
      onError({
        message: error instanceof Error ? error.message : "Photo failed",
      });
    } finally {
      setUploading(false);
    }
  };
  return (
    <View style={s.page}>
      <Header title="Task" onBack={() => router.back()} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <Caption style={s.danger}>{query.error.message}</Caption>
        ) : t ? (
          <>
            <Body style={s.title}>{t.title}</Body>
            <Caption>
              {t.assignee?.name ?? "Unassigned"} · {statusLabels[t.status]}
              {t.atRisk ? " · At risk" : ""}
              {t.waiting ? " · Waiting" : ""}
              {t.upForGrabs ? " · Up for grabs" : ""}
            </Caption>
            {t.notes ? <Body>{t.notes}</Body> : null}
            <View style={s.section}>
              <Eyebrow>Dates · Auckland</Eyebrow>
              <Body>Due {formatTaskDate(t.dueAt)}</Body>
              <Caption>Agreed {formatTaskDate(t.plannedDueAt)}</Caption>
              {t.projectedDueAt.getTime() !== t.dueAt.getTime() ? (
                <Caption>Projected {formatTaskDate(t.projectedDueAt)}</Caption>
              ) : null}
              {t.hardDeadlineAt ? (
                <Caption>
                  Hard deadline {formatTaskDate(t.hardDeadlineAt)}
                </Caption>
              ) : null}
              <Caption>
                {t.gig?.title ?? "No gig"} · Reviewer:{" "}
                {t.reviewer?.name ?? "None"}
              </Caption>
              {t.blockedReason ? (
                <Caption>
                  Blocked: {t.blockedReason}. Check back{" "}
                  {t.checkBackAt ? formatTaskDate(t.checkBackAt) : "not set"}.
                </Caption>
              ) : null}
            </View>
            {t.sourceQuote ? (
              <View style={s.row}>
                <Eyebrow>{t.sourceSubject ?? t.source}</Eyebrow>
                <Body>{t.sourceQuote}</Body>
              </View>
            ) : null}
            {t.status === "PROPOSED" ? (
              <View style={s.section}>
                <TaskChoices
                  label="Accept for"
                  value={owner || t.assigneeId || ""}
                  onChange={setOwner}
                  choices={
                    options.data?.people.map((p) => ({
                      id: p.id,
                      label: `${p.name} · ${p.load.count} due`,
                    })) ?? []
                  }
                />
                <TaskInput
                  label="Due · YYYY-MM-DD HH:mm · Auckland"
                  value={acceptDate ?? dateText(t.dueAt)}
                  onChangeText={setAcceptDate}
                />
                <View style={s.buttons}>
                  <Button
                    disabled={busy || !acceptedDue || !(owner || t.assigneeId)}
                    onPress={() => {
                      if (acceptedDue)
                        accept.mutate({
                          id,
                          assigneeId: owner || t.assigneeId!,
                          dueAt: acceptedDue,
                        });
                    }}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onPress={() => dismiss.mutate({ id })}
                  >
                    Dismiss
                  </Button>
                </View>
              </View>
            ) : (
              <>
                <View style={s.buttons}>
                  <Caption>Act on behalf (recorded)</Caption>
                  <Switch value={onBehalf} onValueChange={setOnBehalf} />
                </View>
                <View style={s.buttons}>
                  {statusActions(t, options.data?.userId ?? "", onBehalf)
                    .filter((rule) => rule.to !== "TODO")
                    .map((rule) => (
                      <Button
                        key={rule.to}
                        variant={
                          rule.to === "DONE" || rule.to === "IN_REVIEW"
                            ? "accent"
                            : "outline"
                        }
                        disabled={
                          busy ||
                          ((rule.to === "DONE" || rule.to === "IN_REVIEW") &&
                            t.waiting)
                        }
                        onPress={() => {
                          if (rule.to === "BLOCKED") {
                            setBody(t.blockedReason ?? "");
                            setDate(
                              dateText(
                                t.checkBackAt && t.checkBackAt > new Date()
                                  ? t.checkBackAt
                                  : new Date(Date.now() + 86400_000),
                              ),
                            );
                            setMode("blocked");
                          } else if (rule.reason) setMode("return");
                          else status.mutate({ id, status: rule.to });
                        }}
                      >
                        {rule.to === "DONE"
                          ? t.status === "IN_REVIEW"
                            ? "Approve"
                            : "Done"
                          : rule.to === "IN_REVIEW"
                            ? "Send for review"
                            : rule.to === "IN_PROGRESS"
                              ? t.status === "IN_REVIEW"
                                ? "Send back"
                                : t.status === "DONE"
                                  ? "Reopen"
                                  : "Start"
                              : rule.to === "BLOCKED" && t.status === "BLOCKED"
                                ? "Update block"
                                : statusLabels[rule.to]}
                      </Button>
                    ))}
                  {isOpen(t.status) && t.status !== "IN_REVIEW" ? (
                    <>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onPress={() => {
                          setDate(
                            dateText(
                              new Date(
                                Math.max(Date.now(), t.dueAt.getTime()) +
                                  86400_000,
                              ),
                            ),
                          );
                          setMode("delay");
                        }}
                      >
                        Need more time
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy || t.upForGrabs}
                        onPress={() => setMode("offer")}
                      >
                        Pass it on
                      </Button>
                    </>
                  ) : null}
                  {(t.overdue || t.upForGrabs || t.unassigned) &&
                  t.status !== "IN_REVIEW" &&
                  !t.waiting &&
                  t.assigneeId !== options.data?.userId ? (
                    <Button disabled={busy} onPress={() => take.mutate({ id })}>
                      Take it
                    </Button>
                  ) : null}
                </View>
              </>
            )}
            {mode ? (
              <View style={s.section}>
                <Eyebrow>{mode}</Eyebrow>
                <TaskInput
                  label="Reason"
                  multiline
                  value={body}
                  onChangeText={setBody}
                  maxLength={4000}
                />
                {mode === "delay" || mode === "blocked" ? (
                  <TaskInput
                    label={
                      mode === "blocked"
                        ? "Check back · YYYY-MM-DD HH:mm · Auckland"
                        : "New due · YYYY-MM-DD HH:mm · Auckland"
                    }
                    value={date}
                    onChangeText={setDate}
                  />
                ) : null}
                {mode === "delay" ? (
                  <>
                    <Caption>
                      {impact.isPending
                        ? "Checking impact…"
                        : impact.data?.length
                          ? `${impact.data.length} tasks affected`
                          : "No downstream dates move"}
                    </Caption>
                    {impact.data?.map((c) => (
                      <Caption key={c.taskId}>
                        {c.title} · {formatTaskDate(c.projectedDueAt)}
                        {c.atRisk ? " · Deadline at risk" : ""}
                      </Caption>
                    ))}
                    <Button
                      variant="outline"
                      disabled={!due || triage.isPending}
                      onPress={() => {
                        if (due) triage.mutate({ id, dueAt: due });
                      }}
                    >
                      Suggest a fix
                    </Button>
                    {triage.data ? (
                      <>
                        <Body>{triage.data.summary}</Body>
                        {triage.data.suggestions.map((s, i) => (
                          <Caption key={i}>{s.reason}</Caption>
                        ))}
                      </>
                    ) : null}
                  </>
                ) : null}
                <View style={s.buttons}>
                  <Button
                    disabled={
                      busy ||
                      !body.trim() ||
                      ((mode === "delay" || mode === "blocked") && !due)
                    }
                    onPress={() => {
                      if (mode === "delay" && due)
                        delay.mutate({ id, dueAt: due, body });
                      else if (mode === "offer") offer.mutate({ id, body });
                      else if (mode === "blocked" && due)
                        status.mutate({
                          id,
                          status: "BLOCKED",
                          body,
                          checkBackAt: due,
                        });
                      else if (mode === "return")
                        status.mutate({ id, status: "IN_PROGRESS", body });
                    }}
                  >
                    Send
                  </Button>
                  <Button variant="outline" onPress={() => setMode(null)}>
                    Cancel
                  </Button>
                </View>
              </View>
            ) : null}
            <Button
              variant="outline"
              onPress={() => {
                setEdit(!edit);
                setTitle(t.title);
                setNotes(t.notes ?? "");
                setOwner(t.assigneeId ?? "");
                setReviewer(t.reviewerId ?? "");
                setGig(t.gigId ?? "");
                setCritical(t.critical);
                setProofRequired(t.proofRequired);
                setDate(dateText(t.dueAt));
              }}
            >
              Edit task
            </Button>
            {edit ? (
              <View style={s.section}>
                <TaskInput
                  label="Title"
                  value={title}
                  onChangeText={setTitle}
                />
                <TaskInput
                  label="Notes"
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
                <TaskChoices
                  label="Owner"
                  value={owner}
                  onChange={setOwner}
                  choices={[
                    { id: "", label: "Unassigned" },
                    ...(options.data?.people.map((p) => ({
                      id: p.id,
                      label: `${p.name} · ${p.load.count} due`,
                    })) ?? []),
                  ]}
                />
                <TaskChoices
                  label="Reviewer"
                  value={reviewer}
                  onChange={setReviewer}
                  choices={[
                    { id: "", label: "None" },
                    ...(options.data?.people.map((p) => ({
                      id: p.id,
                      label: p.name,
                    })) ?? []),
                  ]}
                />
                <TaskChoices
                  label="Gig"
                  value={gig}
                  onChange={setGig}
                  choices={[
                    { id: "", label: "None" },
                    ...(options.data?.gigs.map((g) => ({
                      id: g.id,
                      label: g.title,
                    })) ?? []),
                  ]}
                />
                <TaskInput
                  label="Due · YYYY-MM-DD HH:mm · Auckland"
                  value={date}
                  onChangeText={setDate}
                />
                {impact.data?.map((c) => (
                  <Caption key={c.taskId}>
                    {c.title} → {formatTaskDate(c.projectedDueAt)}
                    {c.atRisk ? " · At risk" : ""}
                  </Caption>
                ))}
                <View style={s.buttons}>
                  <Body>Critical</Body>
                  <Switch value={critical} onValueChange={setCritical} />
                  <Body>Photo required</Body>
                  <Switch
                    value={proofRequired}
                    onValueChange={setProofRequired}
                  />
                </View>
                <Button
                  disabled={update.isPending || !due || !title.trim()}
                  onPress={() => {
                    if (due)
                      update.mutate({
                        id,
                        title,
                        notes,
                        assigneeId: owner || null,
                        reviewerId: reviewer || null,
                        gigId: gig || null,
                        dueAt: due,
                        critical,
                        proofRequired,
                      });
                  }}
                >
                  Save changes
                </Button>
              </View>
            ) : null}
            <View style={s.section}>
              <Eyebrow>Dependencies</Eyebrow>
              {t.dependencies.map((d) => (
                <View key={d.dependsOnId} style={s.row}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/tasks/[taskId]",
                        params: { taskId: d.dependsOnId },
                      })
                    }
                  >
                    <Body>
                      Waits on{" "}
                      {t.linked.find((l) => l.id === d.dependsOnId)?.title}
                    </Body>
                    <Caption>{d.gapMinutes} minutes after completion</Caption>
                  </Pressable>
                  <Button
                    variant="outline"
                    disabled={remove.isPending}
                    onPress={() =>
                      remove.mutate({ id, dependsOnId: d.dependsOnId })
                    }
                  >
                    Remove link
                  </Button>
                </View>
              ))}
              {t.dependents.map((d) => (
                <Pressable
                  accessibilityRole="button"
                  key={d.taskId}
                  onPress={() =>
                    router.push({
                      pathname: "/tasks/[taskId]",
                      params: { taskId: d.taskId },
                    })
                  }
                >
                  <Body>
                    Waiting on this:{" "}
                    {t.linked.find((l) => l.id === d.taskId)?.title}
                  </Body>
                </Pressable>
              ))}
              <TaskChoices
                label="Link dependency"
                value={dep}
                onChange={setDep}
                choices={[
                  { id: "", label: "None" },
                  ...(all.data
                    ?.filter((t) => t.id !== id)
                    .map((t) => ({ id: t.id, label: t.title })) ?? []),
                ]}
              />
              {dep ? (
                <>
                  <TaskInput
                    label="Gap in minutes (blank uses planned gap)"
                    value={gap}
                    onChangeText={setGap}
                    keyboardType="number-pad"
                  />
                  <Button
                    variant="outline"
                    disabled={!suggest.data}
                    onPress={() =>
                      setGap(String(suggest.data?.gapMinutes ?? 0))
                    }
                  >
                    Use {suggest.data?.gapMinutes ?? "…"} min ·{" "}
                    {suggest.data?.samples ?? 0} samples
                  </Button>
                  <Button
                    disabled={add.isPending}
                    onPress={() =>
                      add.mutate({
                        id,
                        dependsOnId: dep,
                        ...(gap ? { gapMinutes: Number(gap) } : {}),
                      })
                    }
                  >
                    Link
                  </Button>
                </>
              ) : null}
            </View>
            <View style={s.section}>
              <Eyebrow>Proof {t.proofRequired ? "· Required" : ""}</Eyebrow>
              {t.proof ? (
                <Button
                  variant="outline"
                  onPress={() => {
                    void Linking.openURL(t.proof!.url);
                  }}
                >
                  View proof
                </Button>
              ) : null}
              <Button
                variant="outline"
                disabled={uploading}
                onPress={() => void pickProof()}
              >
                {uploading ? "Uploading…" : "Attach photo"}
              </Button>
              {t.proof ? (
                <Button
                  variant="outline"
                  disabled={assess.isPending}
                  onPress={() => assess.mutate({ id })}
                >
                  Check photo with AI
                </Button>
              ) : null}
              {t.proofAssessment ? (
                <Caption>{t.proofAssessment}</Caption>
              ) : null}
            </View>
            <TaskInput
              label="Comment"
              multiline
              value={comment}
              onChangeText={setComment}
              maxLength={4000}
            />
            <Button
              disabled={!comment.trim() || post.isPending}
              onPress={() => post.mutate({ id, body: comment })}
            >
              Post comment
            </Button>
            <View style={s.section}>
              <Eyebrow>Timeline</Eyebrow>
              {t.timeline.map((e) => (
                <View style={s.row} key={e.id}>
                  <Body>
                    {e.actor?.name ?? "System"} ·{" "}
                    {e.kind.replaceAll("_", " ").toLowerCase()}
                    {e.onBehalf ? " · on behalf" : ""}
                  </Body>
                  {e.body ? <Caption>{e.body}</Caption> : null}
                  {e.toDueAt ? (
                    <Caption>Due {formatTaskDate(e.toDueAt)}</Caption>
                  ) : null}
                  <Caption>{formatTaskDate(e.createdAt)}</Caption>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
