import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, ScrollView, Switch, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import { useStaff } from "@/lib/staff";
import { Body, Button, Caption, Header } from "@/components/ui";
import {
  TaskChoices,
  TaskInput,
  dateText,
  parseTaskDate,
  taskStyles as s,
} from "@/components/tasks/shared";
import { uploadTaskImage } from "@/lib/task-upload";
import { usePendingTaskShare } from "@/lib/task-share";
export default function NewTask() {
  const router = useRouter(),
    utils = api.useUtils(),
    { isAdmin } = useStaff();
  const options = api.tasks.options.useQuery(undefined, { enabled: isAdmin }),
    all = api.tasks.list.useQuery(undefined, { enabled: isAdmin });
  const [paste, setPaste] = useState(false),
    [title, setTitle] = useState(""),
    [text, setText] = useState(""),
    [owner, setOwner] = useState(""),
    [reviewer, setReviewer] = useState(""),
    [gig, setGig] = useState(""),
    [dep, setDep] = useState(""),
    [date, setDate] = useState(dateText(new Date(Date.now() + 86400_000))),
    [critical, setCritical] = useState(false),
    [images, setImages] = useState<string[]>([]),
    [uploading, setUploading] = useState(false);
  const shared = usePendingTaskShare();
  const onError = (e: { message: string }) =>
    Alert.alert("Could not save", e.message);
  const create = api.tasks.create.useMutation({ onError }),
    extract = api.tasks.extract.useMutation({
      onSuccess: (tasks) => {
        void utils.tasks.invalidate();
        shared.clear();
        Alert.alert("Ready to review", `${tasks.length} proposed tasks`);
        router.replace("/tasks");
      },
      onError,
    });
  const client = utils.client;
  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
      quality: 0.9,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const ids: string[] = [];
      for (const asset of result.assets)
        ids.push(
          await uploadTaskImage(
            client,
            asset.uri,
            asset.fileName ?? "chat.jpg",
            asset.mimeType ?? "image/jpeg",
          ),
        );
      setImages((prev) => [...prev, ...ids].slice(0, 5));
    } catch (e) {
      onError({ message: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  };
  const importShare = async () => {
    if (!shared.pending) return;
    setPaste(true);
    setText(shared.pending.text ?? "");
    setUploading(true);
    try {
      const ids: string[] = [];
      for (const file of shared.pending.images)
        ids.push(await uploadTaskImage(client, file.uri, file.name, file.type));
      setImages(ids);
      shared.clear();
    } catch (e) {
      onError({
        message: e instanceof Error ? e.message : "Share import failed",
      });
    } finally {
      setUploading(false);
    }
  };
  return (
    <View style={s.page}>
      <Header title="Add task" onBack={() => router.back()} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <View style={s.buttons}>
          <Button
            variant={!paste ? "accent" : "outline"}
            onPress={() => setPaste(false)}
          >
            Quick add
          </Button>
          <Button
            variant={paste ? "accent" : "outline"}
            onPress={() => setPaste(true)}
          >
            Paste chat
          </Button>
        </View>
        {shared.pending ? (
          <Button
            variant="outline"
            disabled={uploading}
            onPress={() => void importShare()}
          >
            Import shared chat / screenshots
          </Button>
        ) : null}
        {paste ? (
          <>
            <TaskInput
              label="Chat or brain dump"
              multiline
              numberOfLines={8}
              value={text}
              onChangeText={setText}
              maxLength={30000}
            />
            <Button
              variant="outline"
              disabled={uploading || images.length >= 5}
              onPress={() => void pick()}
            >
              {uploading
                ? "Uploading…"
                : `Add screenshots (${images.length}/5)`}
            </Button>
            <Caption>
              AI reads this through OpenRouter. Every result is a proposal to
              review.
            </Caption>
            <Button
              disabled={
                extract.isPending ||
                uploading ||
                (!text.trim() && !images.length)
              }
              onPress={() =>
                extract.mutate({
                  text:
                    text.trim() ||
                    "Extract commitments from these screenshots.",
                  imageUploadIds: images,
                })
              }
            >
              {extract.isPending ? "Extracting…" : "Propose tasks"}
            </Button>
          </>
        ) : (
          <>
            <TaskInput
              label="Title"
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />
            <TaskInput
              label="Notes"
              multiline
              value={text}
              onChangeText={setText}
            />
            <TaskChoices
              label="Owner · due this week"
              value={owner}
              onChange={setOwner}
              choices={[
                { id: "", label: "Unassigned" },
                ...(options.data?.people.map((p) => ({
                  id: p.id,
                  label: `${p.name} · ${p.load.count} · ${p._count.deviceTokens} devices`,
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
            <TaskInput
              label="Due · YYYY-MM-DD HH:mm · Auckland"
              value={date}
              onChangeText={setDate}
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
            <TaskChoices
              label="Depends on"
              value={dep}
              onChange={setDep}
              choices={[
                { id: "", label: "None" },
                ...(all.data?.map((t) => ({ id: t.id, label: t.title })) ?? []),
              ]}
            />
            <View style={s.buttons}>
              <Body>Critical</Body>
              <Switch value={critical} onValueChange={setCritical} />
            </View>
            <Button
              disabled={create.isPending || !title.trim() || !owner}
              onPress={() => {
                const dueAt = parseTaskDate(date);
                if (!dueAt) {
                  Alert.alert(
                    "Check date",
                    "Use YYYY-MM-DD HH:mm in Auckland time.",
                  );
                  return;
                }
                void (async () => {
                  try {
                    const task = await create.mutateAsync({
                      title,
                      notes: text || null,
                      assigneeId: owner || null,
                      reviewerId: reviewer || null,
                      dueAt,
                      gigId: gig || null,
                      critical,
                      dependsOnId: dep || undefined,
                    });
                    await utils.tasks.invalidate();
                    router.replace({
                      pathname: "/tasks/[taskId]",
                      params: { taskId: task.id },
                    });
                  } catch {
                    /* Mutation displays its error. */
                  }
                })();
              }}
            >
              Create task
            </Button>
          </>
        )}
      </ScrollView>
    </View>
  );
}
