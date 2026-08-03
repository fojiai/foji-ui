"use client";

import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "checked"> {
  /** `true` | `false` | `"indeterminate"` (for a partially-selected header checkbox). */
  checked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Accessible checkbox. Implemented as a `role="checkbox"` button rather than a
 * native input so it can be styled consistently — the repo forbids raw
 * `<input type="checkbox">`.
 */
const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => {
    const isIndeterminate = checked === "indeterminate";
    const isChecked = checked === true;

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={isIndeterminate ? "mixed" : isChecked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!isChecked)}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none",
          "focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          "flex items-center justify-center transition-colors",
          (isChecked || isIndeterminate) && "bg-primary text-primary-foreground",
          className
        )}
        {...props}
      >
        {isIndeterminate ? (
          <Minus className="h-3 w-3" />
        ) : isChecked ? (
          <Check className="h-3 w-3" />
        ) : null}
      </button>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
