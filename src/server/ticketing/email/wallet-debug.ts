import "server-only";

import { sendTransactional } from "~/server/ticketing/email/provider";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Fixed, intentionally small wrapper for an admin-built standalone pass. */
export function renderWalletDebugEmail({ passName }: { passName: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const name = passName.trim() || "Apple Wallet test pass";
  return {
    subject: `Your ${name}`,
    text: `Your standalone Apple Wallet pass is attached.\n\nOpen the .pkpass attachment on an Apple device to add it to Wallet. This pass is not linked to an Atmos ticket or order.`,
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(name)}</title></head>
<body style="margin:0;padding:0;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:0 0 28px;font-size:18px;font-weight:800;letter-spacing:.22em;">ATMOS</td></tr>
        <tr><td style="padding:0 0 14px;font-size:28px;line-height:1.2;font-weight:800;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:0 0 18px;color:#b4b4bc;font-size:15px;line-height:1.6;">The standalone <strong style="color:#fff">.pkpass</strong> file is attached. Open it on an Apple device to add it to Wallet.</td></tr>
        <tr><td style="padding:18px 0 0;border-top:1px solid #2a2a2e;color:#8f8f98;font-size:12px;line-height:1.6;">This debug pass is not linked to an Atmos ticket, order, event, QR secret, or Wallet registration.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

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
  return sendTransactional({
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
