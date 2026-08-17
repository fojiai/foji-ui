"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";

/**
 * Plain-language setup guide for connecting WhatsApp.
 *
 * The connection itself is one click, but three things outside our product can
 * silently sink it: a number that is still active in the WhatsApp app, a
 * missing payment method on the customer's Meta account, and not finishing
 * Meta's popup. All three fail as silence, so they are spelled out up front
 * rather than diagnosed afterwards.
 */
export function WhatsAppSetupGuide() {
  const t = useTranslations();

  const steps = [1, 2, 3, 4, 5, 6] as const;

  return (
    <div className="space-y-5 rounded-xl border bg-muted/30 p-4">
      <div>
        <p className="type-label text-muted-foreground">{t("agents.whatsapp.guide.eyebrow")}</p>
        <h4 className="type-display mt-1 text-base">{t("agents.whatsapp.guide.title")}</h4>
      </div>

      {/* Prerequisites first: every item here is something the customer cannot
          fix once they are halfway through Meta's popup. */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("agents.whatsapp.guide.beforeTitle")}</p>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {[1, 2, 3].map((n) => (
            <li key={n} className="flex gap-2">
              <span aria-hidden className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{t(`agents.whatsapp.guide.before${n}` as never)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* The one mistake that cannot be undone from inside Foji. */}
      <div className="flex gap-2 rounded-lg border border-spark/40 bg-spark/10 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-spark-ink" />
        <p className="text-xs text-spark-ink">{t("agents.whatsapp.guide.numberWarning")}</p>
      </div>

      <ol className="space-y-3">
        {steps.map((n) => (
          <li key={n} className="flex gap-3">
            <span className="type-readout mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold text-muted-foreground">
              {n}
            </span>
            <div className="min-w-0">
              <p className="text-sm">{t(`agents.whatsapp.guide.step${n}` as never)}</p>
              {(n === 5 || n === 6) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(`agents.whatsapp.guide.step${n}Hint` as never)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted-foreground">{t("agents.whatsapp.guide.closing")}</p>
    </div>
  );
}
