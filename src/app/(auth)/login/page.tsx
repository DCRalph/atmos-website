import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "~/server/auth";
import { LoginForm } from "../../../components/auth/login-form";

export default async function LoginPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  // If already logged in, redirect to home
  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="bg-background relative flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}
