"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Bot, Pencil, Shield, Globe, MessageSquare, Briefcase, Scale, Cpu } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { agentsApi, type Agent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageLoader } from "@/components/shared/loading-spinner";
import { NoCompanyState } from "@/components/shared/empty-state";
import { toast } from "@/hooks/use-toast";

// API returns PascalCase enums — normalize to snake_case/kebab-case for i18n keys
const INDUSTRY_KEY_MAP: Record<string, string> = {
  AccountingFinance: "accounting_finance",
  Law: "law",
  InternalSystems: "internal_systems",
};
const LANGUAGE_KEY_MAP: Record<string, string> = {
  PtBr: "pt-br",
  En: "en",
  Es: "es",
};

const INDUSTRY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
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
    if (user?.isSuperAdmin) {
      return (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">{t("agents.title")}</h1>
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-medium">{t("superAdmin.noCompanySelectedTitle")}</p>
                <p className="text-sm text-muted-foreground mt-1">{t("superAdmin.noCompanySelected")}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">{t("agents.title")}</h1>
        <NoCompanyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("agents.title")}</h1>
        <Button asChild>
          <Link href="agents/new">
            <Plus className="mr-1 h-4 w-4" /> {t("agents.create")}
          </Link>
        </Button>
      </div>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Bot className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium">{t("agents.empty")}</p>
            <p className="text-sm text-muted-foreground">{t("agents.emptyDescription")}</p>
            <Button asChild className="mt-2">
              <Link href="agents/new">
                <Plus className="mr-1 h-4 w-4" /> {t("agents.create")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => {
            const industryKey = normalizeIndustry(agent.industryType);
            const languageKey = normalizeLanguage(agent.agentLanguage);
            const IndustryIcon = INDUSTRY_ICON[industryKey] ?? Bot;

            return (
              <Link key={agent.id} href={`agents/${agent.id}`} className="group">
                <Card className="h-full transition-all duration-200 group-hover:shadow-lg group-hover:border-primary/30 group-hover:-translate-y-0.5">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <IndustryIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{agent.name}</CardTitle>
                          {agent.description && (
                            <CardDescription className="line-clamp-1 mt-0.5">{agent.description}</CardDescription>
                          )}
                        </div>
                      </div>
                      <Badge variant={agent.isActive ? "success" : "outline"} className="shrink-0">
                        {agent.isActive ? t("agents.status.active") : t("agents.status.inactive")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Briefcase className="h-3 w-3" />
                        {t(`agents.industries.${industryKey}` as any)}
                      </Badge>
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Globe className="h-3 w-3" />
                        {t(`agents.languages.${languageKey}` as any)}
                      </Badge>
                      {agent.whatsAppEnabled && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <MessageSquare className="h-3 w-3" />
                          WhatsApp
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">
                        {agent.fileCount ?? 0} {t("files.title").toLowerCase()}
                      </span>
                      <span className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
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
