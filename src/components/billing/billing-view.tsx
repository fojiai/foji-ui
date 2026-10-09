"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, CalendarClock, Check, Clock, CreditCard, FileText, PauseCircle, QrCode, ReceiptText } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import {
  analyticsApi, agentsApi, billingApi, plansApi, subscriptionsApi, whatsAppUsageApi, apiErrorMessage,
  type BillingActionResult, type BillingCycle, type BillingPayment, type BillingProfile, type CompanyStats,
  type Plan, type Subscription, type WhatsAppUsage,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { HeatStatus } from "@/components/shared/heat";
import { WhatsAppCosts } from "@/components/agents/whatsapp-costs";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BillingProfileDialog } from "./billing-profile-dialog";
import { ChoosePlanDialog } from "./choose-plan-dialog";

/** Subscription status on the heat scale: running, waiting on the user, cold. */
function statusHeat(status: string): "live" | "attention" | "cool" | "idle" {
  switch (status) {
    case "active": return "cool";
    case "trialing": case "past_due": case "unpaid": return "attention";
    default: return "idle";
  }
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit === 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="type-readout font-medium">
          {used.toLocaleString()} {unlimited ? "" : `/ ${limit.toLocaleString()}`}
        </span>
      </div>
      {!unlimited && (
        <Progress
          value={pct}
          className={pct >= 90 ? "bg-spark/25 [&>div]:bg-spark" : "bg-muted [&>div]:bg-muted-foreground/70"}
        />
      )}
    </div>
  );
}

function Banner({ tone, icon: Icon, children, actions }: {
  tone: "spark" | "destructive" | "muted";
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const styles = {
    spark: "border-spark/40 bg-spark/10 text-spark-ink",
    destructive: "border-destructive/40 bg-destructive/10 text-destructive-ink",
    muted: "border-border bg-muted/50 text-foreground",
  }[tone];
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center", styles)}>
      <div className="flex flex-1 items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm font-medium leading-relaxed">{children}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function BillingView() {
  const t = useTranslations("billing");
  const tAll = useTranslations();
  const format = useFormatter();
  const { user, activeCompanyId } = useAuth();
  const isOwner = !!user?.companies?.find((c) => c.companyId === activeCompanyId && c.role === "owner");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [profile, setProfile] = useState<BillingProfile | null>(null);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [agentCount, setAgentCount] = useState(0);
  const [waUsage, setWaUsage] = useState<WhatsAppUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [picked, setPicked] = useState<Plan | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [afterProfile, setAfterProfile] = useState<Plan | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const polling = useRef(false);

  const money = (v: number) => format.number(v, { style: "currency", currency: "BRL" });
  const day = (iso?: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "long" }) : "");
  const short = (iso?: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "short" }) : "");

  const loadBilling = useCallback(async () => {
    if (!activeCompanyId) return;
    const [sub, prof, pays] = await Promise.all([
      subscriptionsApi.getSubscription(activeCompanyId).catch(() => null),
      isOwner ? billingApi.getProfile(activeCompanyId).catch(() => null) : Promise.resolve(null),
      isOwner ? billingApi.payments(activeCompanyId).catch(() => []) : Promise.resolve([]),
    ]);
    setSubscription(sub);
    setProfile(prof);
    setPayments(pays);
    if (sub?.cycle) setCycle(sub.cycle);
    return sub;
  }, [activeCompanyId, isOwner]);

  useEffect(() => {
    if (!activeCompanyId) return;
    Promise.all([
      plansApi.list().then(setPlans).catch(() => setPlans([])),
      loadBilling(),
      analyticsApi.getCompanyStats(activeCompanyId).then(setStats).catch(() => null),
      agentsApi.list(activeCompanyId).then((a) => setAgentCount(a.length)).catch(() => null),
      whatsAppUsageApi.get(activeCompanyId).then(setWaUsage).catch(() => setWaUsage(null)),
    ]).finally(() => setIsLoading(false));
  }, [activeCompanyId, loadBilling]);

  // Arriving from onboarding with a plan picked: start that plan's flow.
  useEffect(() => {
    if (isLoading || !isOwner || plans.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const wanted = Number(params.get("plan"));
    if (!wanted) return;
    window.history.replaceState(null, "", window.location.pathname);
    const p = plans.find((x) => x.id === wanted);
    if (p) choose(p);
  }, [isLoading, isOwner, plans]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back from the Asaas page: the payment is confirmed by webhook a few seconds
  // later, so wait for it here instead of showing the old plan.
  useEffect(() => {
    if (!activeCompanyId || polling.current) return;
    const params = new URLSearchParams(window.location.search);
    const checkoutId = Number(params.get("checkout"));
    const status = params.get("status");
    if (!checkoutId || !status) return;
    window.history.replaceState(null, "", window.location.pathname);

    if (status === "canceled") { toast({ title: t("checkoutCanceled") }); return; }
    if (status === "expired") { toast({ title: t("checkoutExpired") }); return; }

    polling.current = true;
    setConfirming(true);
    let tries = 0;
    const tick = async () => {
      tries++;
      const chk = await billingApi.checkout(activeCompanyId, checkoutId).catch(() => null);
      if (chk?.status === "completed") {
        await loadBilling();
        setConfirming(false);
        toast({ title: t("paymentConfirmed") });
        return;
      }
      if (tries >= 20) {
        setConfirming(false);
        toast({ title: t("stillConfirming") });
        return;
      }
      setTimeout(tick, 3000);
    };
    tick();
  }, [activeCompanyId, loadBilling]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(p: Plan) {
    if (!profile?.complete) {
      setAfterProfile(p);
      setProfileOpen(true);
      return;
    }
    setPicked(p);
  }

  async function act(key: string, fn: () => Promise<BillingActionResult>, success: (r: BillingActionResult) => string) {
    setBusy(key);
    try {
      const r = await fn();
      if (r.action === "redirect" && r.url) { window.location.href = r.url; return; }
      toast({ title: success(r) });
      await loadBilling();
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, tAll("errors.generic")) });
    } finally {
      setBusy(null);
    }
  }

  function onPlanDone(r: BillingActionResult) {
    setPicked(null);
    toast({ title: r.action === "scheduled" ? t("planScheduled", { date: day(r.effectiveAt) }) : t("planApplied") });
    loadBilling();
  }

  if (isLoading) return <PageLoader />;

  const sub = subscription;
  const plan = sub?.plan;
  const companyId = activeCompanyId!;
  const trialDaysLeft = sub?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;
  const paidRunning = !!sub?.isPaid && ["active", "past_due", "unpaid"].includes(sub.status);
  const hasYearly = plans.some((p) => p.yearlyPrice);

  const methodLabel = !sub?.paymentMethod
    ? null
    : sub.paymentMethod === "credit_card"
      ? sub.cardLast4
        ? t("methodCard", { brand: sub.cardBrand ?? "", last4: sub.cardLast4 })
        : t("methodCardShort")
      : sub.paymentMethod === "pix" ? t("methodPix") : t("methodManual");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      {confirming && (
        <Banner tone="muted" icon={Clock} actions={<LoadingSpinner size="sm" />}>
          {t("confirming")} <span className="font-normal text-muted-foreground">{t("confirmingHint")}</span>
        </Banner>
      )}

      {sub?.status === "trialing" && trialDaysLeft !== null && (
        <Banner tone="spark" icon={Clock}>{t("trialBanner", { days: trialDaysLeft })}</Banner>
      )}

      {sub?.status === "past_due" && (
        <Banner
          tone="destructive"
          icon={AlertTriangle}
          actions={isOwner && (
            <>
              {sub.openInvoiceUrl && (
                <Button size="sm" asChild><a href={sub.openInvoiceUrl}>{t("payNow")}</a></Button>
              )}
              {sub.paymentMethod === "credit_card" && (
                <Button size="sm" variant="outline" disabled={busy === "card"}
                  onClick={() => act("card", () => billingApi.updateCard(companyId), () => "")}>
                  {busy === "card" && <LoadingSpinner size="sm" className="mr-2" />}{t("changeCard")}
                </Button>
              )}
            </>
          )}
        >
          {sub.suspendsAt ? t("pastDueBanner", { date: day(sub.suspendsAt) }) : t("pastDueBannerNoDate")}
        </Banner>
      )}

      {sub?.status === "unpaid" && (
        <Banner
          tone="destructive"
          icon={PauseCircle}
          actions={isOwner && sub.openInvoiceUrl && (
            <Button size="sm" asChild><a href={sub.openInvoiceUrl}>{t("payNow")}</a></Button>
          )}
        >
          {t("unpaidBanner")}
        </Banner>
      )}

      {sub?.status === "active" && sub.cancelAtPeriodEnd && !sub.replacementStartsAt && (
        <Banner
          tone="spark"
          icon={CalendarClock}
          actions={isOwner && (
            <Button size="sm" variant="outline" disabled={busy === "resume"}
              onClick={() => act("resume", () => billingApi.resume(companyId), () => t("resumed"))}>
              {busy === "resume" && <LoadingSpinner size="sm" className="mr-2" />}{t("resume")}
            </Button>
          )}
        >
          {t("canceledBanner", { date: day(sub.currentPeriodEnd) })}
        </Banner>
      )}

      {sub?.replacementStartsAt && (
        <Banner tone="muted" icon={CalendarClock}>{t("replacementBanner", { date: day(sub.replacementStartsAt) })}</Banner>
      )}

      {sub?.pendingPlan && (
        <Banner
          tone="muted"
          icon={CalendarClock}
          actions={isOwner && (
            <Button size="sm" variant="outline" disabled={busy === "pending"}
              onClick={() => act("pending", () => billingApi.cancelPendingChange(companyId), () => t("pendingCanceled"))}>
              {busy === "pending" && <LoadingSpinner size="sm" className="mr-2" />}{t("keepCurrentPlan")}
            </Button>
          )}
        >
          {t("pendingBanner", { plan: sub.pendingPlan.name, date: day(sub.currentPeriodEnd) })}
        </Banner>
      )}

      {sub?.status === "active" && sub.paymentMethod === "pix" && sub.openInvoiceUrl && (
        <Banner tone="spark" icon={QrCode} actions={isOwner && (
          <Button size="sm" asChild><a href={sub.openInvoiceUrl}>{t("payNow")}</a></Button>
        )}>
          {t("pixRenewalBanner")}
        </Banner>
      )}

      {sub && plan && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("currentPlan")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="type-display text-lg">{plan.name}</span>
                <HeatStatus
                  level={statusHeat(sub.status)}
                  label={t(`status.${sub.status}` as "status.active", { fallback: sub.status } as never)}
                />
              </div>
              {sub.isPaid && sub.price != null && (
                <p className="text-sm">
                  <span className="type-readout font-medium">{money(sub.price)}</span>{" "}
                  <span className="text-muted-foreground">{sub.cycle === "yearly" ? t("perYearWord") : t("perMonthWord")}</span>
                </p>
              )}
              {methodLabel && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  {sub.paymentMethod === "pix" ? <QrCode className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                  {methodLabel}
                </p>
              )}
              {sub.isAdminAssigned && <p className="text-xs text-muted-foreground">{t("manualPlan")}</p>}
              {sub.currentPeriodEnd && sub.status === "active" && !sub.cancelAtPeriodEnd && sub.isPaid && (
                <p className="text-xs text-muted-foreground">
                  {sub.paymentMethod === "pix" ? t("nextPixRenewal", { date: short(sub.currentPeriodEnd) }) : t("nextCharge", { date: short(sub.currentPeriodEnd) })}
                </p>
              )}
              {isOwner && paidRunning && sub.status === "active" && !sub.cancelAtPeriodEnd && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {sub.paymentMethod === "credit_card" && (
                    <Button size="sm" variant="outline" disabled={busy === "card"}
                      onClick={() => act("card", () => billingApi.updateCard(companyId), () => "")}>
                      {busy === "card" && <LoadingSpinner size="sm" className="mr-2" />}{t("changeCard")}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setCancelOpen(true)}>
                    {t("cancelSubscription")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("usage")}</CardTitle>
              <CardDescription>{t("usageThisMonth")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <UsageBar label={t("agents")} used={agentCount} limit={plan.maxAgents} />
              {plan.hasWhatsApp && waUsage && !waUsage.unlimited && (
                <div className="space-y-1">
                  <UsageBar label={t("whatsappMessages")} used={waUsage.used} limit={waUsage.limit} />
                  {waUsage.overageMessages > 0 && (
                    <p className="text-xs text-spark-ink">
                      {t("whatsappOverage", { count: waUsage.overageMessages, amount: money(waUsage.overageOwedCentavos / 100) })}
                    </p>
                  )}
                  {waUsage.overLimit && waUsage.overageMessages === 0 && (
                    <p className="text-xs text-spark-ink">{t("whatsappLimitReached")}</p>
                  )}
                </div>
              )}
              {plan.hasWhatsApp && <WhatsAppCosts />}
              {plan.maxConversationsPerMonth > 0 && (
                <UsageBar label={t("conversations")} used={stats?.totalSessions ?? 0} limit={plan.maxConversationsPerMonth} />
              )}
              {plan.maxMessagesPerMonth > 0 && (
                <UsageBar label={t("messages")} used={stats?.totalMessages ?? 0} limit={plan.maxMessagesPerMonth} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="type-label text-muted-foreground">{t("availablePlans")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("methodNote")}</p>
          </div>
          {hasYearly && (
            <Tabs value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
              <TabsList>
                <TabsTrigger value="monthly">{t("cycleMonthly")}</TabsTrigger>
                <TabsTrigger value="yearly">{t("cycleYearly")}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        {!isOwner && <p className="text-sm text-muted-foreground">{t("ownerOnly")}</p>}

        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((p) => {
            const yearly = cycle === "yearly";
            const unavailable = yearly && !p.yearlyPrice;
            // A trial is not something they bought: every plan, including the one being
            // tried, can be subscribed to.
            const isCurrent = !!sub && (sub.isPaid || sub.isAdminAssigned) && plan?.id === p.id
              && sub.cycle === cycle && !sub.cancelAtPeriodEnd && sub.status !== "canceled";
            const price = yearly ? p.yearlyPrice ?? 0 : p.monthlyPrice;
            const savings = p.yearlyPrice ? p.monthlyPrice * 12 - p.yearlyPrice : 0;
            const label = isCurrent
              ? t("currentPlan")
              : paidRunning ? t("choosePlan") : t("subscribe");
            return (
              <Card key={p.id} className={cn("plate-interactive relative", isCurrent && "border-primary/50", unavailable && "opacity-60")}>
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2"><Badge className="px-3">{t("yourPlan")}</Badge></div>
                )}
                {!isCurrent && p.slug === "professional" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2"><Badge variant="secondary" className="px-3">{t("popular")}</Badge></div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="type-display">{p.name}</CardTitle>
                  <CardDescription className="space-y-1">
                    {unavailable ? (
                      <span className="block text-sm">{t("onlyMonthly")}</span>
                    ) : (
                      <>
                        <span className="block">
                          <span className="type-readout text-3xl font-semibold text-foreground">{money(price)}</span>
                          <span className="text-muted-foreground">{yearly ? t("perYear") : t("perMonth")}</span>
                        </span>
                        {yearly && (
                          <span className="block text-xs">
                            {t("equivalentPerMonth", { price: money(price / 12) })}
                            {savings > 0 && <> · <span className="font-medium text-quench-ink">{t("yearlySave", { amount: money(savings) })}</span></>}
                          </span>
                        )}
                      </>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="type-readout">{p.maxAgents}</span> {tAll("agents.title")}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {p.maxConversationsPerMonth > 0
                        ? <><span className="type-readout">{p.maxConversationsPerMonth.toLocaleString()}</span> {t("conversationsPerMonth")}</>
                        : t("unlimitedConversations")}
                    </li>
                    {p.hasWhatsApp && (
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-muted-foreground" />WhatsApp</li>
                    )}
                    {p.hasEscalationContacts && (
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-muted-foreground" />{tAll("agents.escalation.title")}</li>
                    )}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "secondary" : p.slug === "professional" ? "default" : "outline"}
                    onClick={() => choose(p)}
                    disabled={!isOwner || isCurrent || unavailable || !!sub?.isAdminAssigned || ["past_due", "unpaid"].includes(sub?.status ?? "")}
                  >
                    {label}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {isOwner && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="h-4 w-4" />{t("invoices")}</CardTitle>
              <CardDescription>{t("invoicesDescription")}</CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setAfterProfile(null); setProfileOpen(true); }}>
              {t("profileEdit")}
            </Button>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("invoicesEmpty")}</p>
            ) : (
              <ul className="divide-y">
                {payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                    <span className="type-readout w-20 shrink-0 text-muted-foreground">
                      {format.dateTime(new Date(`${p.dueDate}T12:00:00`), { dateStyle: "short" })}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t(`invoiceKind.${p.kind}` as "invoiceKind.subscription")}</span>
                    <span className="type-readout font-medium">{money(p.value)}</span>
                    <Badge variant={p.status === "overdue" ? "destructive" : p.status === "pending" ? "outline" : "secondary"}>
                      {t(`invoiceStatus.${p.status}` as "invoiceStatus.pending")}
                    </Badge>
                    <span className="flex gap-3">
                      {p.invoiceUrl && (
                        <a className="text-primary underline-offset-2 hover:underline" href={p.invoiceUrl} target="_blank" rel="noopener noreferrer">
                          {["pending", "overdue"].includes(p.status) ? t("payNow") : t("viewInvoice")}
                        </a>
                      )}
                      {p.nfseUrl && (
                        <a className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline" href={p.nfseUrl} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3.5 w-3.5" />{t("nfse")}
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">{t("poweredBy")}</p>

      {activeCompanyId && (
        <>
          <ChoosePlanDialog
            companyId={activeCompanyId}
            plan={picked}
            cycle={cycle}
            onOpenChange={(open) => !open && setPicked(null)}
            onDone={onPlanDone}
          />
          <BillingProfileDialog
            open={profileOpen}
            onOpenChange={setProfileOpen}
            companyId={activeCompanyId}
            profile={profile}
            onSaved={(saved) => {
              setProfile(saved);
              setProfileOpen(false);
              if (afterProfile) { setPicked(afterProfile); setAfterProfile(null); }
            }}
          />
        </>
      )}

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd) > new Date()
                ? t("cancelBody", { date: day(sub.currentPeriodEnd) })
                : t("cancelBodyNow")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => act("cancel", () => billingApi.cancel(companyId), (r) =>
                r.effectiveAt ? t("canceledToast", { date: day(r.effectiveAt) }) : t("canceledNowToast"))}
            >
              {t("cancelConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
