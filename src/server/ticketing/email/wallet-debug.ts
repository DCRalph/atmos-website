import "server-only";

import { renderWalletDebugEmail } from "~/emails/wallet-debug";
import { sendEmail } from "~/server/email/send";

export async function sendWalletDebugEmail({
  to,
  pass,
  filename,
  passName,
}: {
  to: string;
  pass: Buffer;
  filename: string;
  passName: string;
}) {
  const rendered = renderWalletDebugEmail({ passName });
  return sendEmail({
    from: "tickets",
    to,
    ...rendered,
    attachments: [
      {
        filename,
        content: pass,
        contentType: "application/vnd.apple.pkpass",
      },
    ],
  });
}
