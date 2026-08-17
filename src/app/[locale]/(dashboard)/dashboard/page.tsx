"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bot, BarChart3, Zap, ArrowRight } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/shared/loading-spinner";
import {
  EmptyState,
  NoCompanyState,
  NoCompanySelectedState,
} from "@/components/shared/empty-state";
import { HeatDot } from "@/components/shared/heat";

/** A compact readout — a label, a number, and a hairline. Deliberately not a
 *  card: the anvil band above is the summary, and a row of plates competing
 *  with it is what made the old dashboard read as a wall of nothing. */
function Readout({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-3.5 px-6 py-5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="type-label truncate text-muted-foreground">{label}</p>
        <p className="type-readout mt-1.5 text-xl text-foreground">{value}</p>
      </div>
    </div>
  );
}

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
    return (
      <div className="space-y-6 foji-enter">
        {user?.isSuperAdmin ? <NoCompanySelectedState /> : <NoCompanyState />}
      </div>
    );
  }

  const activeCount = agents.filter((a) => a.isActive).length;
  const hasLive = activeCount > 0;

  const chartData = (stats?.dailyStats ?? []).map((d) => ({
    date: new Date(d.statDate + "T00:00:00").toLocaleDateString("pt-BR", {
      month: "short",
      day: "numeric",
    }),
    conversations: d.sessions,
    messages: d.messages,
  }));

  const totalSessions = stats?.totalSessions ?? 0;

  return (
    <div className="space-y-8">
      {/* ── The anvil ──────────────────────────────────────────────────────
          One heavy slab that answers the only question an owner has on
          opening the app: is my agent working, and what did it do? */}
      <section className="anvil foji-enter relative overflow-hidden rounded-2xl border border-iron-border">
        <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12">
          <div className="min-w-0">
            <p className="type-label flex items-center gap-2 text-iron-muted">
              <span className="h-px w-5 bg-forge" />
              {t("dashboard.tagline")}
            </p>

            <h1 className="type-display mt-3 text-[2rem] text-iron-foreground sm:text-[2.4rem]">
              {t("dashboard.welcome", { name: user?.firstName ?? "" })}
            </h1>

            {/* State in words AND in heat — never colour alone. The gauge that
                used to sit here restated this same sentence in bars; two
                encodings of one fact is noise, so the sentence won. */}
            <p className="mt-3 flex items-center gap-2 text-sm text-iron-muted">
              <HeatDot level={hasLive ? "live" : "idle"} />
              {hasLive
                ? t("dashboard.agentsLive", { active: activeCount, total: agents.length })
                : t("dashboard.noAgentsLive")}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {agents.length === 0 ? (
                <Button asChild>
                  <Link href="agents/new">
                    {t("agents.create")} <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button variant="iron" asChild>
                  <Link href="agents">
                    {t("dashboard.viewAgents")} <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button variant="iron" asChild>
                <Link href="inbox">{t("nav.inbox")}</Link>
              </Button>
            </div>
          </div>

          {/* The readout: the period's work, as an instrument value. */}
          <div className="lg:w-[15rem] lg:border-l lg:border-iron-border lg:pl-8">
            <p className="type-label text-iron-muted">{t("dashboard.totalChats")}</p>
            <p className="type-readout mt-2 text-[3.25rem] leading-none text-iron-foreground">
              {totalSessions.toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-iron-muted">{t("dashboard.last30days")}</p>

            {chartData.length > 1 && (
              <div className="mt-4 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sparkHeat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--spark)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--forge)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="conversations"
                      stroke="var(--spark)"
                      strokeWidth={1.75}
                      fill="url(#sparkHeat)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Readout strip ──────────────────────────────────────────────────
          Detail after the summary. Three, not four: "total de conversas" is the
          band's hero number directly above, and repeating it here told the owner
          the same thing twice before they'd finished reading it once. gap-px
          over a border-coloured ground gives exact hairlines at every
          breakpoint without per-child border juggling. */}
      <div className="plate grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
        {[
          { label: t("dashboard.totalAgents"), value: agents.length, icon: Bot },
          { label: t("dashboard.activeAgents"), value: activeCount, icon: Zap },
          {
            label: t("dashboard.totalMessages"),
            value: stats?.totalMessages?.toLocaleString() ?? "—",
            icon: BarChart3,
          },
        ].map((r) => (
          <div key={r.label} className="bg-card">
            <Readout label={r.label} value={r.value} icon={r.icon} />
          </div>
        ))}
      </div>

      {/* ── Usage chart ────────────────────────────────────────────────── */}
      {chartData.length > 0 ? (
        <Card className="foji-enter">
          <CardHeader>
            <CardTitle>{t("dashboard.conversationsChart")}</CardTitle>
            <CardDescription>{t("dashboard.last30days")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={40}
                />
                <Tooltip
                  cursor={{ stroke: "var(--border)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "10px",
                    fontSize: 12,
                    boxShadow: "var(--shadow-plate-lifted)",
                  }}
                  labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="conversations"
                  name={t("dashboard.conversations")}
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#colorConv)"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          eyebrow={t("emptyStates.eyebrowNothingYet")}
          title={t("dashboard.noData")}
          description={t("dashboard.noDataHint")}
        />
      )}
    </div>
  );
}
