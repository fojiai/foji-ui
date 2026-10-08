"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Circle, Loader2, MessageCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Agent, AgentFile, CompanyStats } from "@/lib/api";
import { useOnboarding } from "./onboarding-provider";
import { STEP_EMBED } from "./getting-started";

type AgentTab = "settings" | "files" | "embed" | "test";
type Mark = "ok" | "warn" | "bad" | "busy" | "todo";

/** Days since the most recent day with at least one conversation, or null if none. */
function daysSinceLastChat(stats: CompanyStats | null): number | null {
  const days = (stats?.dailyStats ?? []).filter((d) => d.sessions > 0).map((d) => d.statDate).sort();
  const last = days.at(-1);
  if (!last) return null;
  const then = new Date(last + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - then.getTime()) / 86_400_000));
}

/**
 * "Is it working?" — the question every new owner asks, answered in plain
 * words: one verdict sentence, then each thing that has to be true, with a
 * button to fix whichever isn't. Conversation recency is company-wide (that's
 * what analytics records), which is what an owner means by "is it working".
 */
export function AgentHealth({
  agent,
  files,
  stats,
  goTo,
  compact,
}: {
  agent: Agent;
  /** The agent's documents, when the page has them (agent page). Otherwise fileCount is used. */
  files?: AgentFile[];
  stats: CompanyStats | null;
  /** Switch tabs in place (agent page). Without it, rows link to the agent page. */
  goTo?: (tab: AgentTab) => void;
  compact?: boolean;
}) {
  const t = useTranslations("health");
  const { isDone } = useOnboarding();

  const ready = files ? files.filter((f) => f.processingStatus === "Ready").length : agent.fileCount ?? 0;
  const reading = files ? files.filter((f) => f.processingStatus === "Pending" || f.processingStatus === "Processing").length : 0;
  const waConnected = agent.whatsAppEnabled && !!agent.whatsAppPhoneNumberId;
  const waProblem = waConnected && (agent.whatsAppNeedsReconnect || agent.whatsAppBillingIssue);
  const onSite = isDone(STEP_EMBED);
  const live = (waConnected && !waProblem) || onSite;
  const lastChat = daysSinceLastChat(stats);

  const verdict: "working" | "ready" | "learning" | "off" =
    !agent.isActive || !live ? "off" : ready === 0 ? "learning" : lastChat === null ? "ready" : "working";

  const rows: { key: string; mark: Mark; text: string; fix?: { label: string; tab: AgentTab } }[] = [
    agent.isActive
      ? { key: "on", mark: "ok", text: t("on.ok") }
      : { key: "on", mark: "bad", text: t("on.bad"), fix: { label: t("on.fix"), tab: "settings" } },
    ready > 0
      ? { key: "files", mark: "ok", text: t("files.ok", { count: ready }) }
      : reading > 0
        ? { key: "files", mark: "busy", text: t("files.reading") }
        : { key: "files", mark: "warn", text: t("files.none"), fix: { label: t("files.fix"), tab: "files" } },
    waProblem
      ? { key: "whatsapp", mark: "bad", text: t("whatsapp.problem"), fix: { label: t("whatsapp.fix"), tab: "embed" } }
      : waConnected
        ? { key: "whatsapp", mark: "ok", text: t("whatsapp.ok") }
        : { key: "whatsapp", mark: "todo", text: t("whatsapp.none"), fix: { label: t("whatsapp.connect"), tab: "embed" } },
    onSite
      ? { key: "site", mark: "ok", text: t("site.ok") }
      : { key: "site", mark: "todo", text: t("site.none"), fix: { label: t("site.fix"), tab: "embed" } },
    lastChat === null
      ? { key: "chats", mark: "todo", text: t("chats.none") }
      : { key: "chats", mark: "ok", text: lastChat === 0 ? t("chats.today") : lastChat === 1 ? t("chats.yesterday") : t("chats.daysAgo", { days: lastChat }) },
  ];

  const verdictStyle = {
    working: { icon: CheckCircle2, color: "text-quench-ink", ring: "border-quench" },
    ready: { icon: CheckCircle2, color: "text-quench-ink", ring: "border-quench" },
    learning: { icon: AlertTriangle, color: "text-spark-ink", ring: "border-spark" },
    off: { icon: XCircle, color: "text-destructive-ink", ring: "border-destructive" },
  }[verdict];
  const VerdictIcon = verdictStyle.icon;

  const action = (tab: AgentTab, label: string, primary = false) =>
    goTo ? (
      <Button type="button" size="sm" variant={primary ? "default" : "outline"} onClick={() => goTo(tab)}>
        {label}
      </Button>
    ) : (
      <Button asChild size="sm" variant={primary ? "default" : "outline"}>
        <Link href={`agents/${agent.id}?tab=${tab}`}>{label}</Link>
      </Button>
    );

  return (
    <Card className={cn("plate border-l-4", verdictStyle.ring)}>
      <CardHeader className="space-y-1 pb-3">
        <p className="type-label text-muted-foreground">
          {compact ? t("eyebrowNamed", { name: agent.name }) : t("eyebrow")}
        </p>
        <CardTitle className={cn("type-display flex items-center gap-2 text-lg", verdictStyle.color)}>
          <VerdictIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {t(`verdict.${verdict}.title`)}
        </CardTitle>
        <p className="text-sm text-foreground">{t(`verdict.${verdict}.body`)}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <MarkIcon mark={r.mark} />
              <span className="min-w-[12rem] flex-1 text-sm">{r.text}</span>
              {r.fix && action(r.fix.tab, r.fix.label)}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/60 p-3">
          <MessageCircle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="min-w-[12rem] flex-1 text-sm">{t("testYourself")}</p>
          {action("test", t("testButton"), true)}
        </div>
      </CardContent>
    </Card>
  );
}

function MarkIcon({ mark }: { mark: Mark }) {
  const t = useTranslations("health.marks");
  const common = "h-5 w-5 shrink-0";
  const icon = {
    ok: <CheckCircle2 className={cn(common, "text-quench")} aria-hidden="true" />,
    warn: <AlertTriangle className={cn(common, "text-spark-ink")} aria-hidden="true" />,
    bad: <XCircle className={cn(common, "text-destructive")} aria-hidden="true" />,
    busy: <Loader2 className={cn(common, "animate-spin text-forge")} aria-hidden="true" />,
    todo: <Circle className={cn(common, "text-muted-foreground")} aria-hidden="true" />,
  }[mark];
  return (
    <>
      {icon}
      <span className="sr-only">{t(mark)}</span>
    </>
  );
}
