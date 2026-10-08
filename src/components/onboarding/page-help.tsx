"use client";

import { Lightbulb, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "./onboarding-provider";

/**
 * "What is this page for?" — two or three plain sentences at the top of a
 * page, written for someone who has never used anything like it. Stays until
 * the person says they've got it; "Ver tour" covers it after that.
 */
export function PageHelp({ page }: { page: "agents" | "agent" | "inbox" | "leads" | "handoffs" | "dashboard" | "history" }) {
  const t = useTranslations("pageHelp");
  const { loaded, isDone, complete } = useOnboarding();
  const key = `help:${page}`;
  if (!loaded || isDone(key)) return null;

  return (
    <aside className="foji-enter flex gap-3 rounded-xl border border-l-4 border-l-quench bg-card p-4" aria-label={t("label")}>
      <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-quench-ink" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold">{t(`${page}.title`)}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{t(`${page}.body`)}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 self-start text-muted-foreground"
        onClick={() => complete(key)}
      >
        <X className="mr-1 h-4 w-4" aria-hidden="true" />
        {t("dismiss")}
      </Button>
    </aside>
  );
}
