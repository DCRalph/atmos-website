import {
  COLORS,
  emailShell,
  escapeHtml,
  intro,
  type RenderedEmail,
} from "./layout";

/** The admin's standalone Apple Wallet test pass, sent with the .pkpass attached. */
export function renderWalletDebugEmail({
  passName,
}: {
  passName: string;
}): RenderedEmail {
  const name = passName.trim() || "Apple Wallet test pass";
  return {
    subject: `Your ${name}`,
    text: `Your standalone Apple Wallet pass is attached.\n\nOpen the .pkpass attachment on an Apple device to add it to Wallet. This pass is not linked to an Atmos ticket or order.`,
    html: emailShell({
      title: name,
      body: intro(
        name,
        `The standalone <strong style="color:${COLORS.text}">.pkpass</strong> file is attached. Open it on an Apple device to add it to Wallet.`,
      ),
      footer: escapeHtml(
        "This debug pass is not linked to an Atmos ticket, order, event, QR secret, or Wallet registration.",
      ),
    }),
  };
}
