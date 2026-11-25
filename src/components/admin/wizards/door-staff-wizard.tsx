"use client";

import { useState } from "react";
import { ScanLine, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PickerSelect } from "~/components/ui/picker-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { eventEditorHref, eventLabel, type AdminEvent } from "./event-common";
import { EventGate } from "./gates";
import { DiffList, Loading, type DiffRow } from "./parts";
import { DonePanel, useSteps, WizardFooter, WizardShell } from "./shell";

type Role = AdminEvent["staff"][number]["role"];

type StaffRow = {
  userId: string;
  role: Role;
  name: string;
  email: string;
};

const STEPS = [
  { key: "people", label: "People" },
  { key: "review", label: "Review" },
] as const;

/** The two roles, in plain words. */
const ROLE_TEXT: Record<Role, string> = {
  SCANNER: "Scans people in",
  MANAGER: "Can also undo a scan",
};

/** Who can work the door: add or remove people, then Save. */
export function DoorStaffWizard() {
  return (
    <EventGate
      wizard="door-staff"
      hint={(event) => (event.doorStaff === 0 ? "No door staff" : null)}
    >
      {(eventId) => <Loaded eventId={eventId} />}
    </EventGate>
  );
}

function Loaded({ eventId }: { eventId: string }) {
  const event = api.ticketEvents.byId.useQuery({ id: eventId });
  if (event.isPending) {
    return (
      <WizardShell wizard="door-staff">
        <Loading />
      </WizardShell>
    );
  }
  if (!event.data) {
    return (
      <WizardShell wizard="door-staff">
        <p className="text-sm">That event is gone.</p>
      </WizardShell>
    );
  }
  return <Steps event={event.data} />;
}

function Steps({ event }: { event: AdminEvent }) {
  const utils = api.useUtils();
  const steps = useSteps(STEPS);
  const [baseline] = useState<StaffRow[]>(() =>
    event.staff.map((row) => ({
      userId: row.userId,
      role: row.role,
      name: row.user?.name ?? "Unknown user",
      email: row.user?.email ?? "",
    })),
  );
  const [staff, setStaff] = useState(baseline);
  const [pick, setPick] = useState<Omit<StaffRow, "role"> | null>(null);
  const [role, setRole] = useState<Role>("SCANNER");
  const [isDone, setIsDone] = useState(false);

  const save = api.ticketEvents.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ticketEvents.byId.invalidate({ id: event.id }),
        utils.wizards.eventChoices.invalidate(),
      ]);
      toast.success("Door staff saved");
      setIsDone(true);
    },
    onError: (error) => toast.error(error.message),
  });

  const add = () => {
    if (!pick || staff.some((row) => row.userId === pick.userId)) return;
    setStaff((current) => [...current, { ...pick, role }]);
    setPick(null);
  };

  const before = new Map(baseline.map((row) => [row.userId, row]));
  const after = new Map(staff.map((row) => [row.userId, row]));
  const rows: DiffRow[] = [
    ...staff.flatMap((row): DiffRow[] => {
      const was = before.get(row.userId);
      if (!was) {
        return [
          {
            label: `Added: ${row.name}`,
            before: "Not on the door",
            after: ROLE_TEXT[row.role],
          },
        ];
      }
      return was.role === row.role
        ? []
        : [
            {
              label: row.name,
              before: ROLE_TEXT[was.role],
              after: ROLE_TEXT[row.role],
            },
          ];
    }),
    ...baseline
      .filter((row) => !after.has(row.userId))
      .map((row) => ({
        label: `Removed: ${row.name}`,
        before: ROLE_TEXT[row.role],
        after: "Not on the door",
      })),
  ];

  return (
    <WizardShell
      wizard="door-staff"
      subtitle={eventLabel(event)}
      editorHref={eventEditorHref(event.id)}
      steps={steps}
      isDirty={rows.length > 0}
      done={
        isDone ? (
          <DonePanel
            title="Door staff saved"
            description={`${staff.length} ${staff.length === 1 ? "person" : "people"} on the door. They open the scanner on their own phone.`}
            next={[{ key: "guest-list", eventId: event.id }]}
            links={[
              {
                href: `${eventEditorHref(event.id)}?section=staff`,
                label: "See the door list",
              },
            ]}
          />
        ) : undefined
      }
    >
      {steps.step === "people" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Who is on the door?</CardTitle>
              <CardDescription>
                They open the scanner on their own phone and only see this
                event. Admins and event organisers can already scan every event.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {staff.length === 0 ? (
                <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  Nobody yet.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {staff.map((row) => (
                    <li
                      key={row.userId}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <ScanLine
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {row.name}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {row.email}
                        </p>
                      </div>
                      <RoleSelect
                        size="sm"
                        value={row.role}
                        onChange={(next) =>
                          setStaff((current) =>
                            current.map((r) =>
                              r.userId === row.userId
                                ? { ...r, role: next }
                                : r,
                            ),
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${row.name}`}
                        onClick={() =>
                          setStaff((current) =>
                            current.filter((r) => r.userId !== row.userId),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-56 flex-1">
                  <PickerSelect
                    endpoint={api.pickers.doorStaff}
                    filter={{ excludeEventId: event.id }}
                    value={pick?.userId ?? null}
                    onChange={(userId, option) =>
                      setPick(
                        userId && option
                          ? {
                              userId,
                              name: option.label,
                              email: option.description ?? "",
                            }
                          : null,
                      )
                    }
                    placeholder="Choose someone"
                    searchPlaceholder="Name, or a full email address…"
                    emptyText="Nobody matches. Try their full email address."
                  />
                </div>
                <RoleSelect value={role} onChange={setRole} />
                <Button type="button" disabled={!pick} onClick={add}>
                  <UserPlus className="size-4" /> Add
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                The list shows people who have worked a door before. To add
                anyone else, type their full email address.
              </p>
            </CardContent>
          </Card>
          <WizardFooter onNext={steps.next} />
        </>
      ) : null}

      {steps.step === "review" ? (
        <>
          <DiffList rows={rows} />
          <WizardFooter
            onBack={steps.back}
            label="Save door staff"
            onNext={() =>
              save.mutate({
                id: event.id,
                staff: staff.map(({ userId, role }) => ({ userId, role })),
              })
            }
            disabled={rows.length === 0}
            isPending={save.isPending}
          />
        </>
      ) : null}
    </WizardShell>
  );
}

/** Scanner or manager, described by what each can do. */
function RoleSelect({
  value,
  onChange,
  size = "default",
}: {
  value: Role;
  onChange: (role: Role) => void;
  size?: "sm" | "default";
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as Role)}>
      <SelectTrigger size={size} className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="SCANNER">{ROLE_TEXT.SCANNER}</SelectItem>
        <SelectItem value="MANAGER">{ROLE_TEXT.MANAGER}</SelectItem>
      </SelectContent>
    </Select>
  );
}
