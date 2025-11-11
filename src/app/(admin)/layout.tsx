import { UserIndicator } from "~/components/user-indicator";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UserIndicator />
      {children}
    </>
  );
}