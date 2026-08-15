"use client";

import * as React from "react";
import { useFormatter } from "next-intl";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Calendar + date field built from scratch.
 *
 * input[type=date] renders the browser's own picker, which looks different in
 * every browser and OS, ignores the app's theme entirely, and can't be styled.
 * This one is ours: same surface, same tokens, same behaviour everywhere.
 *
 * Values are exchanged as "YYYY-MM-DD" — the same shape the native input used,
 * so callers didn't have to change.
 */

const WEEKDAY_ANCHOR = new Date(Date.UTC(2024, 0, 7)); // a Sunday

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromISODate(value?: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Days to render for a month view, padded to whole weeks starting Sunday. */
function monthGrid(view: Date): Date[] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export interface DatePickerProps {
  /** "YYYY-MM-DD" or empty. */
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearLabel?: string;
  todayLabel?: string;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  clearLabel = "Limpar",
  todayLabel = "Hoje",
  className,
}: DatePickerProps) {
  const format = useFormatter();
  const selected = React.useMemo(() => fromISODate(value), [value]);

  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<Date>(() => selected ?? new Date());
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // Re-centre on the selected date whenever the panel opens.
  React.useEffect(() => {
    if (open) setView(selected ?? new Date());
  }, [open, selected]);

  // Close on outside click and on Escape — a panel that traps the page is worse
  // than the native control it replaces.
  React.useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const days = React.useMemo(() => monthGrid(view), [view]);
  const today = new Date();

  const weekdays = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(WEEKDAY_ANCHOR);
        d.setUTCDate(WEEKDAY_ANCHOR.getUTCDate() + i);
        return format.dateTime(d, { weekday: "short" }).slice(0, 2);
      }),
    [format]
  );

  function pick(d: Date) {
    onChange(toISODate(d));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-sm",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>
          {selected ? format.dateTime(selected, { dateStyle: "medium" }) : placeholder}
        </span>
        {selected && !disabled && (
          <span
            role="button"
            tabIndex={0}
            aria-label={clearLabel}
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange(""); }
            }}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute z-50 mt-2 w-[17.5rem] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          {/* Month navigation */}
          <div className="mb-2 flex items-center justify-between">
            <Button
              type="button" variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              aria-label="←"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold capitalize">
              {format.dateTime(view, { month: "long", year: "numeric" })}
            </span>
            <Button
              type="button" variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              aria-label="→"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {weekdays.map((w, i) => (
              <span key={i} className="py-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const outside = d.getMonth() !== view.getMonth();
              const isSelected = selected != null && sameDay(d, selected);
              const isToday = sameDay(d, today);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => pick(d)}
                  className={cn(
                    "h-8 rounded-md text-sm transition-colors",
                    "hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    outside && "text-muted-foreground/40",
                    isToday && !isSelected && "font-semibold text-primary",
                    isSelected && "bg-primary font-semibold text-primary-foreground hover:bg-primary"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t pt-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => pick(new Date())}>
              {todayLabel}
            </Button>
            {selected && (
              <Button
                type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                onClick={() => { onChange(""); setOpen(false); }}
              >
                {clearLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
