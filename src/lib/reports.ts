import { z } from "zod";

export const MAX_REPORT_BYTES = 1024 * 1024;

export const createReportSchema = z.object({
  title: z.string().trim().min(1).max(200),
  conversationId: z.uuid(),
  html: z
    .string()
    .trim()
    .min(1)
    .max(MAX_REPORT_BYTES)
    .describe(
      "Self-contained HTML report with inline CSS and static charts (SVG or CSS). No JavaScript or external resources. Use real queried data and state its period, units, sources and limitations.",
    ),
});

/** The report's base styles also give the assistant a compact visual vocabulary. */
export const REPORT_BASE_CSS = `
:root{color-scheme:dark;--background:#0a0a0a;--foreground:#fafafa;--muted:#a1a1a1;--border:#2a2a2a;--accent:#c6ff33}
*{box-sizing:border-box}html{background:var(--background);color:var(--foreground);font:14px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0;padding:28px;overflow-wrap:anywhere}
h1,h2,h3,h4,p{margin:0 0 12px}h1{font-size:30px;line-height:1.2;letter-spacing:-.7px}h2{font-size:19px;margin-top:28px}h3{font-size:15px;margin-top:20px}p{max-width:80ch}strong,b{overflow-wrap:normal}small,.muted{color:var(--muted)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:20px;padding:22px 0;border-bottom:1px solid var(--border)}.stat strong{display:block;font-size:32px;font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:-.7px;white-space:nowrap}.stat span{color:var(--muted);font-size:12px}
section{margin-top:24px}table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--border)}th{color:var(--muted);font-weight:500}svg,img{max-width:100%;height:auto}.chart{margin:20px 0;overflow-x:auto}.table-scroll{overflow-x:auto}.accent{color:var(--accent)}footer{margin-top:28px;padding-top:14px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)}pre{white-space:pre-wrap}a{color:inherit}
@media(max-width:520px){body{padding:20px 16px}h1{font-size:25px}.stats{gap:14px}.stat strong{font-size:27px}th,td{padding:8px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;
