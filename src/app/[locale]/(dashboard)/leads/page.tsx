"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { leadsApi, agentsApi, type Lead, type Agent, apiErrorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Mail, Phone } from "lucide-react";

export default function LeadsPage() {
  const t = useTranslations();
  const format = useFormatter();
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
      } catch (err) {
        toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
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
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("leads.eyebrow")}
        title={t("leads.title")}
        description={t("leads.description")}
        action={
          <span className="type-readout text-sm text-muted-foreground">
            {leads.length} <span className="font-sans">{t("leads.total")}</span>
          </span>
        }
      />

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
        <EmptyState
          eyebrow={t("emptyStates.eyebrowNothingYet")}
          title={t("leads.empty")}
          description={t("leads.emptyHint")}
        />
      ) : (
        <div className="plate divide-y overflow-hidden rounded-xl border bg-card">
          {leads.map((lead) => (
            <div key={lead.id} className="flex items-start justify-between gap-3 p-4">
              <div className="flex min-w-0 items-start gap-4">
                {/* Neutral by design: a lead is a record, not a live state, so
                    the fire palette stays out of it. */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{lead.name || t("leads.anonymous")}</p>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {lead.email && (
                      <span className="flex min-w-0 items-center gap-1">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </span>
                    )}
                    {lead.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="type-readout">{lead.phone}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{lead.agentName}</Badge>
                    <span className="type-readout">
                      {format.dateTime(new Date(lead.createdAt), { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0 capitalize">{lead.source}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
