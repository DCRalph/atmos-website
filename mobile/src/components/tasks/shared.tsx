import type { ReactNode, ComponentProps } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radius, space, type } from "@/lib/theme";
import { Button, Caption } from "@/components/ui";
import { dayKey, nzDate, nzParts } from "~/lib/tasks/time";
export const taskStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: 60, gap: space.xl },
  section: { gap: space.md },
  row: {
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: space.xs,
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: space.md,
    minHeight: 48,
  },
  buttons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  label: { ...type.label, color: colors.textSoft },
  title: { ...type.display, color: colors.text },
  danger: { ...type.caption, color: colors.danger },
  body: { ...type.body, color: colors.text },
});
export function TaskInput({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={taskStyles.section}>
      <Text style={taskStyles.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        style={[taskStyles.input, props.style]}
        placeholderTextColor={colors.textFaint}
      />
    </View>
  );
}
export function TaskChoices({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string;
  choices: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <View style={taskStyles.section}>
      <Text style={taskStyles.label}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {choices.map((c) => (
          <Button
            key={c.id}
            variant={value === c.id ? "accent" : "outline"}
            onPress={() => onChange(c.id)}
          >
            {c.label}
          </Button>
        ))}
      </ScrollView>
    </View>
  );
}
export function dateText(date: Date) {
  const p = nzParts(date);
  return `${dayKey(date)} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}
export function parseTaskDate(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = nzDate(match[1]!, Number(match[2]), Number(match[3]));
  return Number.isFinite(date.getTime()) && dateText(date) === value.trim()
    ? date
    : null;
}
export function ErrorText({ children }: { children: ReactNode }) {
  return <Caption style={{ color: colors.danger }}>{children}</Caption>;
}
