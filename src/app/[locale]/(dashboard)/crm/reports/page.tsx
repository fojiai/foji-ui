"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { useAuth } from "@/components/providers/auth-provider";
import { crmAnalyticsApi, subscriptionsApi, type CrmSummary, apiErrorMessage } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { HeatStatus } from "@/components/shared/heat";
import { toast } from "@/hooks/use-toast";
import { TrendingUp, Timer, Wallet, Target } from "lucide-react";

/**
 * Chart colors come from the theme tokens, never literals — a hardcoded hex
 * cannot follow the theme, so every chart here was drawn in light-mode colours
 * even in dark mode. chart-4 is the cooled teal that carries neutral/positive
 * magnitude; chart-1 is the ember red, reserved for lost deals. That pairing
 * survives colorblind separation, which the obvious green/red does not
 * (deutan ΔE 5.0).
 */
const WON = "var(--chart-4)";
const LOST = "var(--chart-1)";
const MAGNITUDE = "var(--chart-4)";

/** Shared axis/tooltip styling, matching the dashboard chart. */
const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" };
const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  fontSize: 12,
  boxShadow: "var(--shadow-plate-lifted)",
};
const TOOLTIP_LABEL_STYLE = { color: "var(--foreground)", fontWeight: 600 };

export default function CrmReportsPage() {
  const t = useTranslations();
  const format = useFormatter();
  const { activeCompanyId } = useAuth();
  const locale = (useParams().locale as string) ?? "pt-br";

  const [hasCrm, setHasCrm] = useState<boolean | null>(null);
  const [days, setDays] = useState("90");
  const [data, setData] = useState<CrmSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    (async () => {
      try {
        const sub = await subscriptionsApi.getSubscription(activeCompanyId).catch(() => null);
        const enabled = sub?.plan?.hasCrm ?? false;
        if (cancelled) return;
        setHasCrm(enabled);
        if (enabled) {
          const summary = await crmAnalyticsApi.summary(activeCompanyId, Number(days));
          if (!cancelled) setData(summary);
        }
      } catch {
        if (!cancelled) toast({ variant: "destructive", title: t("errors.generic") });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function changeRange(value: string) {
    setDays(value);
    if (!activeCompanyId) return;
    setIsFetching(true);
    try {
      setData(await crmAnalyticsApi.summary(activeCompanyId, Number(value)));
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setIsFetching(false);
    }
  }

  const money = (v: number) =>
    format.number(v ?? 0, { style: "currency", currency: data?.currency || "BRL", maximumFractionDigits: 0 });

  const monthLabel = (year: number, month: number) =>
    format.dateTime(new Date(year, month - 1, 1), { month: "short", year: "2-digit" });

  const funnelData = useMemo(
    () => (data?.funnel ?? []).map((s) => ({ name: s.stageName, value: s.openValue, count: s.openDeals })),
    [data]
  );

  const monthlyData = useMemo(
    () =>
      (data?.monthlyOutcomes ?? []).map((m) => ({
        name: monthLabel(m.year, m.month),
        won: m.won,
        lost: m.lost,
      })),
    [data] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const sourceData = useMemo(
    () => (data?.sources ?? []).map((s) => ({ name: s.source, value: s.contacts })),
    [data]
  );

  if (isLoading) return <PageLoader />;

  if (!hasCrm) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("crm.eyebrow")}
          title={t("crm.reports.title")}
          description={t("crm.reports.description")}
        />
        <EmptyState
          tone="warn"
          eyebrow={t("emptyStates.eyebrowBilling")}
          title={t("crm.locked.title")}
          description={t("crm.locked.description")}
          action={
            <Button asChild>
              <Link href={`/${locale}/billing`}>{t("crm.locked.upgrade")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) return null;

  const hasClosed = data.wonDeals + data.lostDeals > 0;

  return (
    <div className="space-y-6" aria-busy={isFetching}>
      <PageHeader
        eyebrow={t("crm.eyebrow")}
        title={t("crm.reports.title")}
        description={t("crm.reports.description")}
        action={
          <>
            {isFetching && <LoadingSpinner size="sm" />}
            <Select value={days} onValueChange={changeRange}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">{t("crm.reports.last30")}</SelectItem>
                <SelectItem value="90">{t("crm.reports.last90")}</SelectItem>
                <SelectItem value="365">{t("crm.reports.last365")}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      {/* Headline numbers — these are stat tiles, not charts. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Wallet className="h-4 w-4" />}
          label={t("crm.reports.openPipeline")}
          value={money(data.openValue)}
          hint={t("crm.reports.openDeals", { count: data.openDeals })}
        />
        <StatTile
          icon={<Target className="h-4 w-4" />}
          label={t("crm.reports.winRate")}
          value={hasClosed ? `${data.winRate}%` : "—"}
          hint={t("crm.reports.wonLost", { won: data.wonDeals, lost: data.lostDeals })}
        />
        <StatTile
          icon={<TrendingUp className="h-4 w-4" />}
          label={t("crm.reports.avgDeal")}
          value={data.wonDeals > 0 ? money(data.averageWonValue) : "—"}
          hint={t("crm.reports.wonValue", { value: money(data.wonValue) })}
        />
        <StatTile
          icon={<Timer className="h-4 w-4" />}
          label={t("crm.reports.avgCycle")}
          value={data.averageCycleDays != null ? t("crm.reports.days", { count: data.averageCycleDays }) : "—"}
          hint={t("crm.reports.cycleHint")}
        />
      </div>

      {/* Tasks strip */}
      <div className="plate flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-sm">
        <span className="type-label text-muted-foreground">{t("crm.reports.tasksLabel")}</span>
        <span className="type-readout text-muted-foreground">
          {t("crm.tasks.openCount", { count: data.openTasks })}
        </span>
        {data.overdueTasks > 0 && (
          <HeatStatus
            level="attention"
            label={t("crm.tasks.overdueCount", { count: data.overdueTasks })}
          />
        )}
        <span className="ml-auto text-muted-foreground">
          {t("crm.reports.contactsSummary", { total: data.totalContacts, added: data.newContacts })}
        </span>
      </div>

      {/* Funnel — magnitude by ordered stage. Single hue; values labelled directly. */}
      <Card>
        <CardHeader>
          <CardTitle className="type-display text-base">{t("crm.reports.funnelTitle")}</CardTitle>
          <CardDescription>{t("crm.reports.funnelHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {funnelData.length === 0 ? (
            <Empty text={t("crm.reports.noData")} />
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => money(Number(v))}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    formatter={(v: number, _n, item) => [
                      `${money(v)} · ${t("crm.reports.dealsCount", { count: item?.payload?.count ?? 0 })}`,
                      t("crm.reports.openPipeline"),
                    ]}
                  />
                  <Bar dataKey="value" fill={MAGNITUDE} radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Won vs lost over time — two series, so a legend is always present. */}
      <Card>
        <CardHeader>
          <CardTitle className="type-display text-base">{t("crm.reports.outcomesTitle")}</CardTitle>
          <CardDescription>{t("crm.reports.outcomesHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <Empty text={t("crm.reports.noClosed")} />
          ) : (
            <>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "var(--muted)" }}
                      contentStyle={TOOLTIP_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                    />
                    {/* Recharts tints the legend *label* with the series colour, which put
                        teal text on a white plate at 3.99:1. The swatch carries the
                        colour; the label goes back to body text. */}
                    <Legend
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value: string) => (
                        <span style={{ color: "var(--foreground)" }}>{value}</span>
                      )}
                    />
                    <Bar dataKey="won" name={t("crm.dealStatuses.Won")} fill={WON} radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="lost" name={t("crm.dealStatuses.Lost")} fill={LOST} radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table view — identity never depends on color alone. */}
              <div className="mt-4 overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>{t("crm.reports.month")}</TableHead>
                      <TableHead className="text-right">{t("crm.dealStatuses.Won")}</TableHead>
                      <TableHead className="text-right">{t("crm.dealStatuses.Lost")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyData.map((m) => (
                      <TableRow key={m.name}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="type-readout text-right">{m.won}</TableCell>
                        <TableCell className="type-readout text-right">{m.lost}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Where contacts come from */}
      <Card>
        <CardHeader>
          <CardTitle className="type-display text-base">{t("crm.reports.sourcesTitle")}</CardTitle>
          <CardDescription>{t("crm.reports.sourcesHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {sourceData.length === 0 ? (
            <Empty text={t("crm.reports.noData")} />
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    formatter={(v: number) => [v, t("crm.reports.contacts")]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {sourceData.map((s) => (
                      <Cell key={s.name} fill={MAGNITUDE} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  icon, label, value, hint,
}: {
  icon: React.ReactNode; label: string; value: string; hint: string;
}) {
  return (
    <Card className="plate">
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="type-label">{label}</span>
        </div>
        <p className="type-readout mt-2 text-2xl font-semibold">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{text}</p>;
}
