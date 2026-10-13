import { AdminSection } from "~/components/admin/admin-section";
import { WalletPassDebugger } from "~/components/admin/ticketing/wallet-pass-debugger";

export default function WalletDebuggerPage() {
  return (
    <AdminSection
      title="Wallet pass debugger"
      description="Build, sign, download and email a test pass: a sample night, a real event, or a real ticket."
    >
      <WalletPassDebugger />
    </AdminSection>
  );
}
