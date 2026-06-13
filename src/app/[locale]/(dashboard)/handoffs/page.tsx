"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/providers/auth-provider";
import { handoffsApi, agentsApi, type HandoffEvent, type Agent } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";
import { PhoneForwarded, Mail, CheckCircle2, Clock } from "lucide-react";

export default function HandoffsPage() {
  const t = useTranslations();
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
      const filtered = await handoffsApi.list(activeCompanyId, agentId);
      setHandoffs(filtered);
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("handoffs.title")}</h1>
          <p className="text-muted-foreground">{t("handoffs.description")}</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {handoffs.length} {t("handoffs.total")}
        </Badge>
      </div>

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
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <PhoneForwarded className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">{t("handoffs.empty")}</p>
            <p className="text-xs text-muted-foreground max-w-sm">{t("handoffs.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {handoffs.map((h) => (
            <Card key={h.id}>
              <CardContent className="flex items-start justify-between py-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <PhoneForwarded className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    {h.userMessage && (
                      <p className="text-sm text-muted-foreground italic">"{h.userMessage}"</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{h.agentName}</Badge>
                      <span>{new Date(h.createdAt).toLocaleString()}</span>
                      <span className="font-mono opacity-60">#{h.sessionId.slice(0, 8)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {h.notificationSent ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {t("handoffs.notified")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" /> {t("handoffs.pending")}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="capitalize">{h.source}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
