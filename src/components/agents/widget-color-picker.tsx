"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Check, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { WIDGET_COLOR_PRESETS, inkOn, isHexColor, needsOutline } from "@/lib/widget-colors";

/**
 * Picking the chat colour without knowing what a hex code is: tap a suggested
 * colour, or open the system colour picker from the big swatch. The hex field
 * stays for people who have their brand code at hand.
 */
export function WidgetColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const t = useTranslations("agents.appearance");
  const pickerId = useId();
  const valid = isHexColor(value);
  const current = valid ? value.toUpperCase() : "";
  const shown = valid ? value : "#E5262B";
  const darkInk = valid && inkOn(value) !== "#ffffff";

  return (
    <div className="space-y-3">
      <Label htmlFor={pickerId}>{t("primaryColor")}</Label>
      <p className="text-xs text-muted-foreground">{t("colorHint")}</p>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("suggestedColors")}>
        {WIDGET_COLOR_PRESETS.map((c) => {
          const selected = current === c.hex;
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t(`colors.${c.key}`)}
              title={t(`colors.${c.key}`)}
              onClick={() => onChange(c.hex)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected ? "border-foreground" : "border-transparent"
              )}
              style={{ backgroundColor: c.hex }}
            >
              {selected && <Check className="h-5 w-5" style={{ color: inkOn(c.hex) }} />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* The native picker: a real colour wheel on every OS, no library. */}
        <label
          htmlFor={pickerId}
          className="relative flex h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-muted"
        >
          <span
            className="h-6 w-6 rounded-full border"
            style={{ background: valid ? value : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
          />
          {t("pickAnyColor")}
          <input
            id={pickerId}
            type="color"
            value={valid ? value : "#E5262B"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("hexCode")}</span>
          <Input
            value={value}
            placeholder="#E5262B"
            maxLength={7}
            className="h-9 w-28 font-mono"
            aria-label={t("hexCode")}
            onChange={(e) => {
              let v = e.target.value.trim();
              if (v && !v.startsWith("#")) v = "#" + v;
              onChange(v);
            }}
          />
        </div>
      </div>

      {/* What the visitor will actually see in the corner of the site. */}
      <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow",
            needsOutline(shown) && "border border-zinc-200"
          )}
          style={{ backgroundColor: shown }}
          aria-hidden="true"
        >
          <MessageCircle className="h-6 w-6" style={{ color: inkOn(shown) }} />
        </span>
        <p className="text-xs text-muted-foreground">{t("preview")}</p>
      </div>
      {darkInk && <p className="text-xs text-muted-foreground">{t("tooLight")}</p>}
      {value && !valid && <p className="text-xs text-destructive-ink">{t("invalidHex")}</p>}
    </div>
  );
}
