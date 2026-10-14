# Data table

Reusable admin table copied from `dcralph.net` and adapted for this codebase.

`DataTable` supports typed columns, custom cells, column visibility, sorting,
filtering, selection, loading and empty states, and optional pagination. Existing
admin screens can continue to own their server search and pagination while using
the common renderer by leaving `enableSearch` and `enablePagination` disabled.

```tsx
<DataTable
  columns={columns}
  data={rows}
  getRowId={(row) => row.id}
  storageKey="admin-users"
  emptyMessage="No users found."
/>
```

Rows that open their own page take `getRowHref`; the whole row is the link
(Cmd/Ctrl or middle click opens a new tab), so don't add an Edit or Manage
button. Buttons, links, switches and menus inside a row keep their own click
and never open the row. Use `onRowClick` for rows that open something in place,
like a sheet.
