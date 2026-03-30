"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Clock, CreditCard, ExternalLink, XCircle } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { analyticsApi, agentsApi, plansApi, subscriptionsApi, type Plan, type Subscription, type CompanyStats } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";

function statusVariant(status: string): "default" | "success" | "warning" | "destructive" | "outline" {
  switch (status) {
    case "active": return "success";
    case "trialing": return "warning";
    case "past_due": return "destructive";
    case "canceled":
    case "unpaid": return "outline";
    default: return "default";
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "active": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "trialing": return <Clock className="h-4 w-4 text-yellow-500" />;
    case "past_due": return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default: return <XCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit === 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used.toLocaleString()} {unlimited ? "" : `/ ${limit.toLocaleString()}`}
        </span>
      </div>
      {!unlimited && <Progress value={pct} className={pct >= 90 ? "bg-red-100 [&>div]:bg-red-500" : ""} />}
    </div>
  );
}

export default function BillingPage() {
  const t = useTranslations();
  const { activeCompanyId } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [agentCount, setAgentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<number | null>(null);

  useEffect(() => {
    if (!activeCompanyId) { setIsLoading(false); return; }
    Promise.all([
      plansApi.list(),
      subscriptionsApi.getSubscription(activeCompanyId).catch(() => null),
      analyticsApi.getCompanyStats(activeCompanyId).catch(() => null),
      agentsApi.list(activeCompanyId).catch(() => []),
    ])
      .then(([p, sub, s, agents]) => {
        setPlans(p);
        setSubscription(sub);
        setStats(s);
        setAgentCount((agents ?? []).length);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [activeCompanyId]);

  async function openPortal() {
    if (!activeCompanyId) return;
    setPortalLoading(true);
    try {
      const { portalUrl } = await subscriptionsApi.portal(activeCompanyId);
      window.location.href = portalUrl;
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setPortalLoading(false);
    }
  }

  async function subscribe(planId: number) {
    if (!activeCompanyId) return;
    setCheckoutLoading(planId);
    try {
      const { checkoutUrl } = await subscriptionsApi.checkout(activeCompanyId, planId);
      window.location.href = checkoutUrl;
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setCheckoutLoading(null);
    }
  }

  const plan = subscription?.plan;
  const trialDaysLeft = subscription?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("billing.title")}</h1>
        {subscription && (
          <Button variant="outline" onClick={openPortal} disabled={portalLoading}>
            {portalLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <ExternalLink className="mr-1 h-4 w-4" /> {t("billing.manageBilling")}
              </>
            )}
          </Button>
        )}
      </div>

      {/* ── Trial banner ─────────────────────────────────────────────────── */}
      {subscription?.status === "trialing" && trialDaysLeft !== null && (
        <Card className="border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="flex items-center gap-3 py-4">
            <Clock className="h-5 w-5 shrink-0 text-yellow-600" />
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              {t("billing.trialBanner", { days: trialDaysLeft })}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Past due banner ─────────────────────────────────────────────── */}
      {subscription?.status === "past_due" && (
        <Card className="border-red-400 bg-red-50 dark:bg-red-950/20">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {t("billing.pastDueBanner")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Current plan + usage ─────────────────────────────────────────── */}
      {subscription && plan && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("billing.currentPlan")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                {statusIcon(subscription.status)}
                <span className="text-lg font-semibold">{plan.name}</span>
                <Badge variant={statusVariant(subscription.status) as any}>
                  {t(`billing.status.${subscription.status}` as any, { fallback: subscription.status })}
                </Badge>
              </div>
              {subscription.currentPeriodEnd && (
                <p className="text-xs text-muted-foreground">
                  {t("billing.periodEnd")}: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("billing.usage")}</CardTitle>
              <CardDescription>{t("billing.usageThisMonth")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UsageBar
                label={t("billing.agents")}
                used={agentCount}
                limit={plan.maxAgents}
              />
              {plan.maxConversationsPerMonth > 0 && (
                <UsageBar
                  label={t("billing.conversations")}
                  used={stats?.totalSessions ?? 0}
                  limit={plan.maxConversationsPerMonth}
                />
              )}
              {plan.maxMessagesPerMonth > 0 && (
                <UsageBar
                  label={t("billing.messages")}
                  used={stats?.totalMessages ?? 0}
                  limit={plan.maxMessagesPerMonth}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Plan picker ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">{t("billing.availablePlans")}</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className="relative">
              {p.slug === "professional" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary px-3">Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">${p.monthlyPriceUsd}</span>
                  <span className="text-muted-foreground">/mo</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    {p.maxAgents} {t("agents.title")}
                  </li>
                  {p.maxConversationsPerMonth > 0 && (
                    <li className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      {p.maxConversationsPerMonth.toLocaleString()} {t("billing.conversationsPerMonth")}
                    </li>
                  )}
                  {p.maxConversationsPerMonth === 0 && (
                    <li className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      {t("billing.unlimitedConversations")}
                    </li>
                  )}
                  {p.hasWhatsApp && (
                    <li className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      WhatsApp
                    </li>
                  )}
                  {p.hasEscalationContacts && (
                    <li className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      {t("agents.escalation.title")}
                    </li>
                  )}
                </ul>
                <Button
                  className="w-full"
                  variant={p.slug === "professional" ? "default" : "outline"}
                  onClick={() => subscribe(p.id)}
                  disabled={checkoutLoading === p.id || subscription?.plan?.id === p.id}
                >
                  {checkoutLoading === p.id ? (
                    <LoadingSpinner size="sm" />
                  ) : subscription?.plan?.id === p.id ? (
                    t("billing.currentPlan")
                  ) : (
                    t("billing.upgrade")
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
