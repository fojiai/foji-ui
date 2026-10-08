"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Agent, CompanyStats } from "@/lib/api";
import { useOnboarding } from "./onboarding-provider";

export const CHECKLIST_HIDDEN = "step:checklist-hidden";
export const STEP_TESTED = "step:tested";
export const STEP_EMBED = "step:embed";

/**
 * "Primeiros passos" — the five things between signing up and a working
 * assistant. Ticks come from real data where we have it (agents, documents,
 * messages, a connected number), so the list can't claim something is done
 * that isn't; the rest are marked when the person does it (opens the test
 * chat, copies the embed code).
 */
export function GettingStarted({ agents, stats }: { agents: Agent[]; stats: CompanyStats | null }) {
  const t = useTranslations("gettingStarted");
  const { loaded, isDone, complete } = useOnboarding();

  if (!loaded || isDone(CHECKLIST_HIDDEN)) return null;

  const first = agents[0];
  const agentHref = (tab: string) => (first ? `agents/${first.id}?tab=${tab}` : "agents/new");

  const items = [
    { key: "createAgent", done: agents.length > 0, href: "agents/new" },
    { key: "describe", done: agents.some((a) => !!a.description?.trim()), href: agentHref("settings") },
    { key: "upload", done: agents.some((a) => (a.fileCount ?? 0) > 0), href: agentHref("files") },
    { key: "test", done: isDone(STEP_TESTED) || (stats?.totalMessages ?? 0) > 0, href: agentHref("test") },
    {
      key: "goLive",
      done: isDone(STEP_EMBED) || agents.some((a) => a.whatsAppEnabled && !!a.whatsAppPhoneNumberId),
      href: agentHref("embed"),
    },
  ];
  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;
  const next = items.find((i) => !i.done);

  return (
    <Card className="plate foji-enter" data-tour="getting-started">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-x-4 gap-y-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="type-display text-lg">{t("title")}</CardTitle>
          <CardDescription>{allDone ? t("allDone") : t("subtitle")}</CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="type-readout text-xs text-muted-foreground">
            {t("progress", { done: doneCount, total: items.length })}
          </span>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => complete(CHECKLIST_HIDDEN)}>
            {t("hide")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={(doneCount / items.length) * 100} aria-label={t("progress", { done: doneCount, total: items.length })} />
        <ol className="divide-y rounded-lg border">
          {items.map((item, i) => {
            const isNext = item === next;
            return (
              <li key={item.key} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3", isNext && "bg-muted/50")}>
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    item.done ? "border-quench bg-quench text-white" : isNext ? "border-primary text-primary" : "text-muted-foreground"
                  )}
                  aria-hidden="true"
                >
                  {item.done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <div className="min-w-[9rem] flex-1">
                  <p className={cn("text-sm font-semibold", item.done && "text-muted-foreground line-through")}>
                    {t(`items.${item.key}.title`)}
                    {item.done && <span className="sr-only"> ✓</span>}
                  </p>
                  {!item.done && <p className="text-xs text-muted-foreground">{t(`items.${item.key}.hint`)}</p>}
                </div>
                {!item.done && (
                  <Button asChild size="sm" variant={isNext ? "default" : "outline"} className="ml-10 sm:ml-0">
                    <Link href={item.href}>
                      {t("go")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
