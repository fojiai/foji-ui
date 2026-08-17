"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Bot, Pencil, Globe, MessageSquare, Briefcase, Scale, Cpu } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { agentsApi, type Agent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageLoader } from "@/components/shared/loading-spinner";
import {
  EmptyState,
  NoCompanyState,
  NoCompanySelectedState,
} from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { HeatStatus } from "@/components/shared/heat";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// API returns PascalCase enums — normalize to snake_case/kebab-case for i18n keys
const INDUSTRY_KEY_MAP: Record<string, string> = {
  AccountingFinance: "accounting_finance",
  Law: "law",
  InternalSystems: "internal_systems",
  GeneralAssistant: "general_assistant",
};
const LANGUAGE_KEY_MAP: Record<string, string> = {
  PtBr: "pt-br",
  En: "en",
  Es: "es",
};

const INDUSTRY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  general_assistant: Bot,
  accounting_finance: Briefcase,
  law: Scale,
  internal_systems: Cpu,
};

function normalizeIndustry(val: string): string {
  return INDUSTRY_KEY_MAP[val] ?? val;
}
function normalizeLanguage(val: string): string {
  return LANGUAGE_KEY_MAP[val] ?? val;
}

export default function AgentsPage() {
  const t = useTranslations();
  const { user, activeCompanyId } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeCompanyId) { setIsLoading(false); return; }
    agentsApi
      .list(activeCompanyId)
      .then(setAgents)
      .catch(() => toast({ variant: "destructive", title: t("errors.generic") }))
      .finally(() => setIsLoading(false));
  }, [activeCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <PageLoader />;

  if (!activeCompanyId) {
    return (
      <div className="space-y-6 foji-enter">
        <PageHeader eyebrow={t("agents.eyebrow")} title={t("agents.title")} />
        {user?.isSuperAdmin ? <NoCompanySelectedState /> : <NoCompanyState />}
      </div>
    );
  }

  const liveCount = agents.filter((a) => a.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("agents.eyebrow")}
        title={t("agents.title")}
        description={
          agents.length > 0
            ? t("agents.liveSummary", { active: liveCount, total: agents.length })
            : undefined
        }
        action={
          <Button asChild>
            <Link href="agents/new">
              <Plus className="mr-1 h-4 w-4" /> {t("agents.create")}
            </Link>
          </Button>
        }
      />

      {agents.length === 0 ? (
        <EmptyState
          eyebrow={t("emptyStates.eyebrowStart")}
          title={t("agents.empty")}
          description={t("agents.emptyDescription")}
          action={
            <Button asChild>
              <Link href="agents/new">
                <Plus className="mr-1 h-4 w-4" /> {t("agents.create")}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="foji-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const industryKey = normalizeIndustry(agent.industryType);
            const languageKey = normalizeLanguage(agent.agentLanguage);
            const IndustryIcon = INDUSTRY_ICON[industryKey] ?? Bot;

            return (
              <Link key={agent.id} href={`agents/${agent.id}`} className="group block">
                {/* One signal, not four. This card used to encode "is it live?"
                    in the background wash, the border, the icon tint AND the
                    status dot — redundant encoding, which reads as noise and
                    spends the fire palette on every card at once. The dot and
                    its label carry the state; the icon tint quietly reinforces
                    it; the plate itself stays neutral. */}
                <Card className="plate-interactive relative h-full overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                            agent.isActive
                              ? "border-forge/25 bg-forge/10 text-forge-ink"
                              : "border-border bg-muted text-muted-foreground"
                          )}
                        >
                          <IndustryIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">{agent.name}</CardTitle>
                          {agent.description && (
                            <CardDescription className="mt-0.5 line-clamp-1">{agent.description}</CardDescription>
                          )}
                        </div>
                      </div>
                      <HeatStatus
                        level={agent.isActive ? "live" : "idle"}
                        label={agent.isActive ? t("agents.status.active") : t("agents.status.inactive")}
                        className="shrink-0 pt-1"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* The industry badge is gone: the card's icon already says
                        it, and three chips per card turned the grid into noise.
                        What's left is what the owner can't infer otherwise —
                        the language it answers in, and whether it's on WhatsApp. */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Globe className="h-3 w-3" />
                        {t(`agents.languages.${languageKey}` as any)}
                      </Badge>
                      {agent.whatsAppEnabled && (
                        <Badge variant="secondary" className="gap-1">
                          <MessageSquare className="h-3 w-3" />
                          WhatsApp
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="type-readout text-xs text-muted-foreground">
                        {agent.fileCount ?? 0}{" "}
                        <span className="font-sans">{t("files.title").toLowerCase()}</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        <Pencil className="h-3 w-3" /> {t("common.edit")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
