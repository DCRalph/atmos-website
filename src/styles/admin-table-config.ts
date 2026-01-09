// Admin table configuration for consistent styling across admin UI

// Color system with better contrast
export const adminTableColors = {
  // Header colors
  headerBg: "bg-slate-800",
  headerText: "text-white",

  // Body colors
  bodyBg: "bg-white",
  bodyText: "text-gray-900",

  // Row colors
  rowHover: "hover:bg-slate-50",
  rowBorder: "border-gray-200",
  rowDivide: "divide-y divide-gray-200",

  // Cell variants
  cellSuccess: "bg-green-50 text-green-800",
  cellWarning: "bg-amber-50 text-amber-800",
  cellError: "bg-red-50 text-red-800",
  cellInfo: "bg-blue-50 text-blue-800",

  // Status indicators
  statusActive: "bg-green-100 text-green-800",
  statusInactive: "bg-gray-100 text-gray-800",
  statusPending: "bg-amber-100 text-amber-800",
  statusError: "bg-red-100 text-red-800",
};

// Common header styles
export const adminTableHeaderStyles = {
  base: "px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider",
  textColor: "text-white",
};

// Common cell styles
export const adminTableCellStyles = {
  base: "px-6 py-4",
  textDefault: "text-gray-900",
  textMuted: "text-gray-500",
  textHighlight: "text-blue-600 font-medium",
};

// Table wrapper styles
export const adminTableWrapperStyles = {
  base: "overflow-x-auto rounded-lg shadow-sm",
  bordered: "border border-gray-200",
  elevated: "shadow-md",
};

// Action button styles
export const adminTableActionStyles = {
  primary: "text-blue-600 hover:text-blue-800",
  destructive: "text-red-600 hover:text-red-800",
  neutral: "text-gray-600 hover:text-gray-800",
};

// Helper for quick access to common combinations
export const adminTablePresets = {
  // Standard table style
  standard: {
    wrapper: `${adminTableWrapperStyles.base} ${adminTableWrapperStyles.bordered}`,
    header: adminTableColors.headerBg,
    body: `${adminTableColors.bodyBg} ${adminTableColors.rowDivide}`,
    row: adminTableColors.rowHover,
  },

  // Compact table with less padding
  compact: {
    wrapper: `${adminTableWrapperStyles.base} ${adminTableWrapperStyles.bordered}`,
    header: adminTableColors.headerBg,
    body: `${adminTableColors.bodyBg} ${adminTableColors.rowDivide}`,
    row: adminTableColors.rowHover,
    cell: "px-4 py-2",
  },

  // Table for data-heavy views
  dataGrid: {
    wrapper: `${adminTableWrapperStyles.base} ${adminTableWrapperStyles.elevated}`,
    header: adminTableColors.headerBg,
    body: `${adminTableColors.bodyBg} ${adminTableColors.rowDivide}`,
    row: adminTableColors.rowHover,
    cell: "px-6 py-3",
  },
};
