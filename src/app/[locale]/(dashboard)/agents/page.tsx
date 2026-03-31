"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Bot, Pencil } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { agentsApi, type Agent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageLoader } from "@/components/shared/loading-spinner";
import { NoCompanyState } from "@/components/shared/empty-state";
import { toast } from "@/hooks/use-toast";

const INDUSTRY_LABELS: Record<string, string> = {
  accounting_finance: "Accounting & Finance",
  law: "Law",
  internal_systems: "Internal Systems",
};

export default function AgentsPage() {
  const t = useTranslations();
  const { activeCompanyId } = useAuth();
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
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{agent.name}</CardTitle>
                  <Badge variant={agent.isActive ? "success" : "outline"}>
                    {agent.isActive ? t("agents.status.active") : t("agents.status.inactive")}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2">{agent.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("agents.industry")}</span>
                  <Badge variant="secondary" className="text-xs">
                    {INDUSTRY_LABELS[agent.industryType] ?? agent.industryType}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("agents.language")}</span>
                  <span>{agent.agentLanguage}</span>
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`agents/${agent.id}`}>
                    <Pencil className="mr-1 h-3 w-3" /> {t("common.edit")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
