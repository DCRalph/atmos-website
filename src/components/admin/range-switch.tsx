"use client";

import { Segmented } from "~/components/admin/segmented";
import {
  ANALYTICS_RANGES,
  ANALYTICS_RANGE_LABELS,
  type AnalyticsRange,
} from "~/lib/analytics-range";

const OPTIONS = ANALYTICS_RANGES.map((range) => ({
  value: range,
  label: ANALYTICS_RANGE_LABELS[range],
}));

/** The 24h / 7d / 30d / All switch every chart range uses. */
export function RangeSwitch({
  value,
  onChange,
}: {
  value: AnalyticsRange;
  onChange: (value: AnalyticsRange) => void;
}) {
  return (
    <Segmented
      label="Range"
      options={OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
