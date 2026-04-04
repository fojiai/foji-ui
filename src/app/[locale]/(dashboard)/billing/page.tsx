"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle, CheckCircle2, Clock, CreditCard, ExternalLink, XCircle,
  Search, ChevronLeft, ChevronRight, Building2, User, Plus, Trash2, Eye,
} from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import {
  analyticsApi, agentsApi, plansApi, subscriptionsApi, adminCompaniesApi,
  type Plan, type Subscription, type CompanyStats, type AdminCompanyListItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";

// ─── Super Admin: Manage All Subscriptions ───────────────────────────────────

const PAGE_SIZE = 20;

const customPlanSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  monthlyPrice: z.coerce.number().min(0),
  maxAgents: z.coerce.number().min(1),
  maxConversationsPerMonth: z.coerce.number().min(0),
  maxMessagesPerMonth: z.coerce.number().min(0),
  hasWhatsApp: z.boolean(),
  hasEscalationContacts: z.boolean(),
});
type CustomPlanForm = z.infer<typeof customPlanSchema>;

function SuperAdminSubscriptionsView() {
  const t = useTranslations();
  const [companies, setCompanies] = useState<AdminCompanyListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);

  // Assign plan dialog state
  const [assignTarget, setAssignTarget] = useState<AdminCompanyListItem | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // Custom plan dialog
  const [customPlanOpen, setCustomPlanOpen] = useState(false);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const customPlanForm = useForm<CustomPlanForm>({
    resolver: zodResolver(customPlanSchema),
    defaultValues: {
      hasWhatsApp: false,
      hasEscalationContacts: false,
      maxConversationsPerMonth: 0,
      maxMessagesPerMonth: 0,
    },
  });

  const load = useCallback(async (q: string, p: number) => {
    setIsLoading(true);
    try {
      const [data, allPlans] = await Promise.all([
        adminCompaniesApi.list(q || undefined, p, PAGE_SIZE),
        plansApi.listAll(),
      ]);
      setCompanies(data.items);
      setTotal(data.total);
      setPlans(allPlans);
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => { load(search, page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(search, 1);
  }

  async function assignPlan() {
    if (!assignTarget || !selectedPlanId) return;
    setAssigning(true);
    try {
      await adminCompaniesApi.assignPlan(assignTarget.id, Number(selectedPlanId));
      toast({ title: t("common.success") });
      setAssignTarget(null);
      setSelectedPlanId("");
      await load(search, page);
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setAssigning(false);
    }
  }

  async function removePlan(companyId: number) {
    try {
      await adminCompaniesApi.removePlan(companyId);
      toast({ title: t("common.success") });
      await load(search, page);
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  async function onCreateCustomPlan(data: CustomPlanForm) {
    setCreatingPlan(true);
    try {
      await plansApi.create({
        ...data,
        isPublic: false,
        isActive: true,
        stripePriceId: "",
      });
      toast({ title: t("common.success") });
      customPlanForm.reset();
      setCustomPlanOpen(false);
      await load(search, page);
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setCreatingPlan(false);
    }
  }

  function subStatusBadge(c: AdminCompanyListItem) {
    if (!c.hasActiveSubscription) {
      return <Badge variant="outline">{t("superAdmin.noSubscription")}</Badge>;
    }
    const variant = c.subscriptionStatus === "active" ? "success"
      : c.subscriptionStatus === "trialing" ? "warning"
      : c.subscriptionStatus === "past_due" ? "destructive"
      : "outline";
    return (
      <div className="flex items-center gap-2">
        <Badge variant={variant as any}>{c.currentPlanName}</Badge>
        {c.subscriptionStatus && c.subscriptionStatus !== "active" && (
          <span className="text-xs text-muted-foreground capitalize">{c.subscriptionStatus}</span>
        )}
      </div>
    );
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (isLoading && companies.length === 0) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("superAdmin.manageSubscriptions")}</h1>
          <p className="text-muted-foreground mt-1">{total} companies</p>
        </div>
        <Button onClick={() => { customPlanForm.reset(); setCustomPlanOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> {t("superAdmin.createCustomPlan")}
        </Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("common.search") + "..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">{t("common.search")}</Button>
      </form>

      {/* Company list */}
      <div className="space-y-2">
        {companies.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No companies found.
            </CardContent>
          </Card>
        ) : companies.map((c) => (
          <Card key={c.id} className="hover:shadow-md transition-shadow">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                  {c.accountType === "Individual"
                    ? <User className="h-4 w-4 text-muted-foreground" />
                    : <Building2 className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.ownerEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                {subStatusBadge(c)}
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setAssignTarget(c); setSelectedPlanId(""); }}
                  >
                    {t("superAdmin.assignPlan")}
                  </Button>
                  {c.hasActiveSubscription && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("common.confirm")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove plan from {c.name}?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removePlan(c.id)}>
                            {t("superAdmin.removePlan")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <Link href={`admin/companies/${c.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Assign plan dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => { if (!open) setAssignTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("superAdmin.assignPlan")}</DialogTitle>
            {assignTarget && (
              <p className="text-sm text-muted-foreground">{assignTarget.name}</p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger><SelectValue placeholder="Select a plan..." /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} — {p.currency === "BRL" ? "R$" : "$"}{p.monthlyPrice}/{p.currency}/mo
                      {!p.isPublic && " (private)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignTarget(null)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={assignPlan} disabled={assigning || !selectedPlanId}>
                {assigning ? <LoadingSpinner size="sm" /> : t("superAdmin.assignPlan")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create custom plan dialog */}
      <Dialog open={customPlanOpen} onOpenChange={setCustomPlanOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("superAdmin.createCustomPlan")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={customPlanForm.handleSubmit(onCreateCustomPlan)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.name")}</Label>
                <Input {...customPlanForm.register("name")} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input {...customPlanForm.register("slug")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.plans.monthlyPrice")}</Label>
                <Input type="number" step="0.01" {...customPlanForm.register("monthlyPrice")} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.plans.maxAgents")}</Label>
                <Input type="number" {...customPlanForm.register("maxAgents")} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.plans.maxConversations")}</Label>
                <Input type="number" {...customPlanForm.register("maxConversationsPerMonth")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.plans.maxMessages")}</Label>
                <Input type="number" {...customPlanForm.register("maxMessagesPerMonth")} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="hasWhatsApp"
                  className="h-4 w-4 rounded border-input"
                  {...customPlanForm.register("hasWhatsApp")}
                />
                <Label htmlFor="hasWhatsApp">WhatsApp</Label>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="hasEscalation"
                  className="h-4 w-4 rounded border-input"
                  {...customPlanForm.register("hasEscalationContacts")}
                />
                <Label htmlFor="hasEscalation">Escalation</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCustomPlanOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={creatingPlan}>
                {creatingPlan ? <LoadingSpinner size="sm" /> : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Regular Billing View (tenant-scoped) ────────────────────────────────────

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

function RegularBillingView() {
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
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const status = params.get("status");

    const promises: Promise<any>[] = [plansApi.list()];
    if (activeCompanyId) {
      // If returning from Stripe checkout, verify the session to force-sync the subscription
      const subPromise = sessionId && status === "success"
        ? subscriptionsApi.verifySession(activeCompanyId, sessionId).catch(() => null)
        : subscriptionsApi.getSubscription(activeCompanyId).catch(() => null);

      promises.push(
        subPromise,
        analyticsApi.getCompanyStats(activeCompanyId).catch(() => null),
        agentsApi.list(activeCompanyId).catch(() => []),
      );
    }
    Promise.all(promises)
      .then(([p, sub, s, agents]) => {
        setPlans(p);
        if (activeCompanyId) {
          setSubscription(sub ?? null);
          setStats(s ?? null);
          setAgentCount((agents ?? []).length);
        }
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
    } catch (err: any) {
      const msg = (err?.data as any)?.error;
      if (msg) {
        toast({ variant: "destructive", title: msg });
      } else {
        toast({ variant: "destructive", title: t("errors.generic") });
      }
    } finally {
      setCheckoutLoading(null);
    }
  }

  function getPlanButtonLabel(p: Plan) {
    if (subscription?.plan?.id === p.id) return t("billing.currentPlan");
    if (!subscription?.plan) return t("billing.upgrade");
    const currentPlan = plans.find((pl) => pl.id === subscription.plan.id);
    if (!currentPlan) return t("billing.upgrade");
    return p.monthlyPrice > currentPlan.monthlyPrice
      ? t("billing.upgrade")
      : t("billing.downgrade");
  }

  const plan = subscription?.plan;
  const trialDaysLeft = subscription?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("billing.title")}</h1>
        {subscription?.hasStripeSubscription && (
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
              <UsageBar label={t("billing.agents")} used={agentCount} limit={plan.maxAgents} />
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

      <div>
        <h2 className="mb-4 text-lg font-semibold">{t("billing.availablePlans")}</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.id} className="relative hover:shadow-md transition-shadow">
              {p.slug === "professional" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary px-3">Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center">
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">{p.currency === "BRL" ? "R$" : "$"}{p.monthlyPrice}</span>
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
                  variant={subscription?.plan?.id === p.id ? "secondary" : p.slug === "professional" ? "default" : "outline"}
                  onClick={() => subscribe(p.id)}
                  disabled={checkoutLoading === p.id || subscription?.plan?.id === p.id}
                >
                  {checkoutLoading === p.id && <LoadingSpinner size="sm" className="mr-2" />}
                  {getPlanButtonLabel(p)}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { user } = useAuth();

  if (user?.isSuperAdmin) return <SuperAdminSubscriptionsView />;
  return <RegularBillingView />;
}
