import { AdminSection } from "~/components/admin/admin-section";
import { WalletPassDebugger } from "~/components/admin/ticketing/wallet-pass-debugger";

export default function WalletDebuggerPage() {
  return (
    <AdminSection
      title="Wallet pass debugger"
      description="Build, sign, download, and email a standalone Apple Wallet pass."
    >
      <WalletPassDebugger />
    </AdminSection>
  );
}
