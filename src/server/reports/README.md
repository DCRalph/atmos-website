# HTML reports

Will GPT creates a report with `reports.create` after querying the relevant
admin APIs. The tool accepts a title, HTML and the current conversation id.
Only the conversation's owner can create reports from it. Any admin can read
the library, matching the shared Will GPT conversation history.

`HtmlReport` stores the title, author, source conversation, creation time, byte
size and object key. R2 holds the HTML. Since the media bucket is public, the
HTML is encrypted with AES-256-GCM and the report id is authenticated alongside
the bytes. The key is derived from `BETTER_AUTH_SECRET`; keep that secret stable
to retain access to existing reports. Rotating it requires re-encrypting the
reports first.

The HTML is limited to 1 MB, sanitized, and given the Atmos report styles and a
restrictive Content Security Policy. Reports support inline CSS, SVG charts,
tables and embedded raster images. Scripts, forms, embedded frames, external
resources and navigation are disabled. Report links always lead to
`/admin/reports/[id]`. There is no raw HTML endpoint, public R2 URL or standalone
document route.

The viewer keeps the admin shell, report metadata and conversation link outside
a sandboxed iframe. `allow-same-origin` lets the parent measure the static
document's height; scripts remain disabled. Failed database writes remove the
new R2 object. Deleting an author or conversation preserves the report and
clears that relation.
