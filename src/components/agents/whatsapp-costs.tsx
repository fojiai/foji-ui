"use client";

import { ExternalLink, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * "Who charges for WhatsApp messages?" — two different costs (the Foji plan's
 * monthly allowance, and Meta's own per-message charge on the customer's Meta
 * card), explained plainly so nobody thinks Foji is adding mystery charges.
 * Meta figures: 1,000 free service messages per number per month since
 * 2026-10-01; business-initiated (template) messages always charged.
 */
export function WhatsAppCosts() {
  const t = useTranslations("whatsappCosts");
  return (
    <section className="space-y-3 rounded-xl border bg-muted/40 p-4" aria-labelledby="wa-costs-title">
      <h3 id="wa-costs-title" className="flex items-center gap-2 text-sm font-semibold">
        <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {t("title")}
      </h3>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">{t("planTitle")}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("plan")}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("planOver")}</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">{t("metaTitle")}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("meta")}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("metaFree")}</p>
        <p className="text-sm leading-relaxed text-foreground">{t("metaWhere")}</p>
      </div>
      <a
        href="https://business.whatsapp.com/products/platform-pricing"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("link")} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </section>
  );
}
