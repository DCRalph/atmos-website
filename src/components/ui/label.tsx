"use client";

import * as React from "react";
import { cn } from "~/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("mb-2 block text-sm font-semibold text-white", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";
