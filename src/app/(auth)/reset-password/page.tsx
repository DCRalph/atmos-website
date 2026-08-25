import { Suspense } from "react";

import { ResetPasswordForm } from "./ResetPasswordForm";

/**
 * Where the "reset your password" link lands.
 *
 * On the web for both surfaces, app included. A reset has to work from the mail
 * app on a handset that may not have Atmos installed, and from a laptop, so the
 * one place it can always work is a page. The app sends people here and picks
 * them up again at the sign-in screen.
 *
 * better-auth validates and consumes the token at
 * `/api/auth/reset-password/:token` and redirects here with it in the query, or
 * with `?error=` when it has expired.
 */
export default function ResetPasswordPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-black p-4 text-white">
      <div className="w-full max-w-md">
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
