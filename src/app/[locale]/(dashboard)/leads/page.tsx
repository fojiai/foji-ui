"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { leadsApi, agentsApi, type Lead, type Agent } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Mail, Phone } from "lucide-react";

export default function LeadsPage() {
  const t = useTranslations();
  const { activeCompanyId } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeCompanyId) return;
    async function load() {
      try {
        const [leadList, agentList] = await Promise.all([
          leadsApi.list(activeCompanyId!),
          agentsApi.list(activeCompanyId!),
        ]);
        setLeads(leadList);
        setAgents(agentList);
      } catch {
        toast({ variant: "destructive", title: t("errors.generic") });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [activeCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAgentFilter(value: string) {
    setSelectedAgent(value);
    if (!activeCompanyId) return;
    try {
      const agentId = value === "all" ? undefined : Number(value);
      const filtered = await leadsApi.list(activeCompanyId, agentId);
      setLeads(filtered);
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("leads.title")}</h1>
          <p className="text-muted-foreground">{t("leads.description")}</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {leads.length} {t("leads.total")}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <Select value={selectedAgent} onValueChange={handleAgentFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t("leads.filterByAgent")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("leads.allAgents")}</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {leads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <UserPlus className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">{t("leads.empty")}</p>
            <p className="text-xs text-muted-foreground max-w-sm">{t("leads.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <Card key={lead.id}>
              <CardContent className="flex items-start justify-between py-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <UserPlus className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">{lead.name || t("leads.anonymous")}</p>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {lead.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" /> {lead.email}
                        </span>
                      )}
                      {lead.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" /> {lead.phone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{lead.agentName}</Badge>
                      <span>{new Date(lead.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 capitalize">{lead.source}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
