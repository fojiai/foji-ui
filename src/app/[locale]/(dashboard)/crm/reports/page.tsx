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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageLoader } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";
import { Lock, TrendingUp, Timer, Wallet, Target, AlertTriangle } from "lucide-react";

/**
 * Chart colors. Teal carries neutral/positive magnitude, red is reserved for
 * lost deals. The obvious green/red pair fails colorblind separation
 * (deutan ΔE 5.0) — this pair clears every check in both light and dark.
 */
const WON = "#0D9488";
const LOST = "#DC2626";
const MAGNITUDE = "#0D9488";

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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("crm.reports.title")}</h1>
          <p className="text-muted-foreground">{t("crm.reports.description")}</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Lock className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">{t("crm.locked.title")}</p>
            <Button asChild className="mt-2">
              <Link href={`/${locale}/billing`}>{t("crm.locked.upgrade")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const hasClosed = data.wonDeals + data.lostDeals > 0;

  return (
    <div className={`space-y-6 ${isFetching ? "opacity-60 transition-opacity" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("crm.reports.title")}</h1>
          <p className="text-muted-foreground">{t("crm.reports.description")}</p>
        </div>
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
      </div>

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
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <span className="text-muted-foreground">{t("crm.reports.tasksLabel")}</span>
        <Badge variant="outline" className="tabular-nums">
          {t("crm.tasks.openCount", { count: data.openTasks })}
        </Badge>
        {data.overdueTasks > 0 && (
          <Badge variant="destructive" className="gap-1 tabular-nums">
            <AlertTriangle className="h-3 w-3" />
            {t("crm.tasks.overdueCount", { count: data.overdueTasks })}
          </Badge>
        )}
        <span className="ml-auto text-muted-foreground">
          {t("crm.reports.contactsSummary", { total: data.totalContacts, added: data.newContacts })}
        </span>
      </div>

      {/* Funnel — magnitude by ordered stage. Single hue; values labelled directly. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("crm.reports.funnelTitle")}</CardTitle>
          <CardDescription>{t("crm.reports.funnelHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {funnelData.length === 0 ? (
            <Empty text={t("crm.reports.noData")} />
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="currentColor" className="text-muted-foreground/15" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => money(Number(v))}
                    tick={{ fontSize: 11 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 12 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    cursor={{ fill: "currentColor", className: "text-muted-foreground/10" }}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
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
          <CardTitle className="text-base">{t("crm.reports.outcomesTitle")}</CardTitle>
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
                    <CartesianGrid vertical={false} stroke="currentColor" className="text-muted-foreground/15" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                    <Tooltip
                      cursor={{ fill: "currentColor", className: "text-muted-foreground/10" }}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="won" name={t("crm.dealStatuses.Won")} fill={WON} radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="lost" name={t("crm.dealStatuses.Lost")} fill={LOST} radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table view — identity never depends on color alone. */}
              <div className="mt-4 rounded-md border">
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
                        <TableCell className="text-right tabular-nums">{m.won}</TableCell>
                        <TableCell className="text-right tabular-nums">{m.lost}</TableCell>
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
          <CardTitle className="text-base">{t("crm.reports.sourcesTitle")}</CardTitle>
          <CardDescription>{t("crm.reports.sourcesHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {sourceData.length === 0 ? (
            <Empty text={t("crm.reports.noData")} />
          ) : (
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="currentColor" className="text-muted-foreground/15" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip
                    cursor={{ fill: "currentColor", className: "text-muted-foreground/10" }}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
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
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs uppercase tracking-wide">{label}</span>
        </div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{text}</p>;
}
