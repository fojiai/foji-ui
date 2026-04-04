"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, MessageSquare, BarChart3, Zap, Shield } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useAuth } from "@/components/providers/auth-provider";
import { agentsApi, analyticsApi, type Agent, type CompanyStats } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageLoader } from "@/components/shared/loading-spinner";
import { NoCompanyState } from "@/components/shared/empty-state";

export default function DashboardPage() {
  const t = useTranslations();
  const { user, activeCompanyId } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeCompanyId) { setIsLoading(false); return; }
    Promise.all([
      agentsApi.list(activeCompanyId),
      analyticsApi.getCompanyStats(activeCompanyId).catch(() => null),
    ])
      .then(([agentList, companyStats]) => {
        setAgents(agentList);
        setStats(companyStats);
      })
      .finally(() => setIsLoading(false));
  }, [activeCompanyId]);

  if (isLoading) return <PageLoader />;

  if (!activeCompanyId) {
    if (user?.isSuperAdmin) {
      return (
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">
            {t("dashboard.welcome", { name: user?.firstName ?? "" })}
          </h1>
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
        <h1 className="text-3xl font-bold tracking-tight">
          {t("dashboard.welcome", { name: user?.firstName ?? "" })}
        </h1>
        <NoCompanyState />
      </div>
    );
  }

  const activeCount = agents.filter((a) => a.isActive).length;

  const statCards = [
    {
      label: t("dashboard.totalAgents"),
      value: agents.length,
      icon: Bot,
    },
    {
      label: t("dashboard.activeAgents"),
      value: activeCount,
      icon: Zap,
    },
    {
      label: t("dashboard.totalChats"),
      value: stats?.totalSessions?.toLocaleString() ?? "—",
      icon: MessageSquare,
    },
    {
      label: t("dashboard.totalMessages"),
      value: stats?.totalMessages?.toLocaleString() ?? "—",
      icon: BarChart3,
    },
  ];

  // Format daily stats for the chart — fill in zero days if gap
  const chartData = (stats?.dailyStats ?? []).map((d) => ({
    date: new Date(d.statDate + "T00:00:00").toLocaleDateString("pt-BR", {
      month: "short",
      day: "numeric",
    }),
    conversations: d.sessions,
    messages: d.messages,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t("dashboard.welcome", { name: user?.firstName ?? "" })}
        </h1>
        <p className="text-muted-foreground">{t("dashboard.title")}</p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Usage chart ────────────────────────────────────────────────── */}
      {chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.conversationsChart")}</CardTitle>
            <CardDescription>{t("dashboard.last30days")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.59 0.25 27)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="oklch(0.59 0.25 27)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="conversations"
                  name={t("dashboard.conversations")}
                  stroke="oklch(0.59 0.25 27)"
                  strokeWidth={2}
                  fill="url(#colorConv)"
                  dot={false}
                  activeDot={{ r: 4, fill: "oklch(0.59 0.25 27)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">{t("dashboard.noData")}</p>
            <p className="text-xs text-muted-foreground">{t("dashboard.noDataHint")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
