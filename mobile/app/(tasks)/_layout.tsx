import { Stack } from "expo-router";
import { BiometricGate } from "@/lib/biometrics";
import { StaffGate } from "@/components/staff-gate";
import { colors } from "@/lib/theme";
export default function TasksLayout() {
  return (
    <StaffGate role="admin">
      <BiometricGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </BiometricGate>
    </StaffGate>
  );
}
