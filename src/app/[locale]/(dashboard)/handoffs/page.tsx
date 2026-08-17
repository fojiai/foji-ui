"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { handoffsApi, agentsApi, type HandoffEvent, type Agent, apiErrorMessage } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { HeatStatus } from "@/components/shared/heat";
import { toast } from "@/hooks/use-toast";
import { PhoneForwarded } from "lucide-react";

export default function HandoffsPage() {
  const t = useTranslations();
  const format = useFormatter();
  const { activeCompanyId } = useAuth();

  const [handoffs, setHandoffs] = useState<HandoffEvent[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeCompanyId) return;
    async function load() {
      try {
        const [handoffList, agentList] = await Promise.all([
          handoffsApi.list(activeCompanyId!),
          agentsApi.list(activeCompanyId!),
        ]);
        setHandoffs(handoffList);
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
      const filtered = await handoffsApi.list(activeCompanyId, agentId);
      setHandoffs(filtered);
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    }
  }

  const pendingCount = handoffs.filter((h) => !h.notificationSent).length;

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("handoffs.eyebrow")}
        title={t("handoffs.title")}
        description={t("handoffs.description")}
        action={
          pendingCount > 0 ? (
            <HeatStatus
              level="attention"
              label={t("handoffs.pendingCount", { count: pendingCount })}
            />
          ) : (
            <span className="type-readout text-sm text-muted-foreground">
              {handoffs.length} <span className="font-sans">{t("handoffs.total")}</span>
            </span>
          )
        }
      />

      <div className="flex items-center gap-3">
        <Select value={selectedAgent} onValueChange={handleAgentFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t("handoffs.filterByAgent")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("handoffs.allAgents")}</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {handoffs.length === 0 ? (
        <EmptyState
          eyebrow={t("emptyStates.eyebrowNothingYet")}
          title={t("handoffs.empty")}
          description={t("handoffs.emptyHint")}
        />
      ) : (
        <div className="plate divide-y overflow-hidden rounded-xl border bg-card">
          {handoffs.map((h) => (
            <div key={h.id} className="flex items-start justify-between gap-3 p-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                  <PhoneForwarded className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  {h.userMessage && (
                    <p className="text-sm italic text-muted-foreground">&ldquo;{h.userMessage}&rdquo;</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{h.agentName}</Badge>
                    <span className="type-readout">
                      {format.dateTime(new Date(h.createdAt), { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    {/* No extra opacity here: muted-foreground is already the
                        quiet tier, and 60% on top of it drops below AA. */}
                    <span className="type-readout">#{h.sessionId.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {/* One device for one fact: the dot and its label carry whether
                    this was notified. An icon-plus-badge said it twice. */}
                <HeatStatus
                  level={h.notificationSent ? "cool" : "attention"}
                  label={h.notificationSent ? t("handoffs.notified") : t("handoffs.pending")}
                />
                <Badge variant="secondary" className="capitalize">{h.source}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
