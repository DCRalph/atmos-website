import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "~/lib/auth";
import { LoginForm } from "./_components/login-form";

export default async function LoginPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  // If already logged in, redirect to home
  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}

