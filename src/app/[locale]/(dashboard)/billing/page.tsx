"use client";

import { useEffect, useState, useCallback } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  AlertTriangle, Check, Clock, ExternalLink,
  Search, ChevronLeft, ChevronRight, Building2, User, Plus, Trash2, Eye,
} from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import {
  analyticsApi, agentsApi, plansApi, subscriptionsApi, adminCompaniesApi, whatsAppUsageApi,
  type Plan, type Subscription, type CompanyStats, type AdminCompanyListItem, type WhatsAppUsage,
  apiErrorMessage,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { HeatStatus } from "@/components/shared/heat";
import { toast } from "@/hooks/use-toast";
import { BillingView } from "@/components/billing/billing-view";

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
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
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
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setAssigning(false);
    }
  }

  async function removePlan(companyId: number) {
    try {
      await adminCompaniesApi.removePlan(companyId);
      toast({ title: t("common.success") });
      await load(search, page);
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    }
  }

  async function onCreateCustomPlan(data: CustomPlanForm) {
    setCreatingPlan(true);
    try {
      await plansApi.create({
        ...data,
        isPublic: false,
        isActive: true,
      });
      toast({ title: t("common.success") });
      customPlanForm.reset();
      setCustomPlanOpen(false);
      await load(search, page);
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
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
          <h1 className="type-display text-[1.9rem] sm:text-[2.15rem]">{t("superAdmin.manageSubscriptions")}</h1>
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
          <Card className="plate">
            <CardContent className="py-10 text-center text-muted-foreground">
              No companies found.
            </CardContent>
          </Card>
        ) : companies.map((c) => (
          <Card key={c.id} className="plate-interactive">
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
                      {p.name} · R$ {p.monthlyPrice}/mês
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
                <Checkbox
                  id="hasWhatsApp"
                  checked={!!customPlanForm.watch("hasWhatsApp")}
                  onCheckedChange={(v) => customPlanForm.setValue("hasWhatsApp", v)}
                />
                <Label htmlFor="hasWhatsApp">WhatsApp</Label>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="hasEscalation"
                  checked={!!customPlanForm.watch("hasEscalationContacts")}
                  onCheckedChange={(v) => customPlanForm.setValue("hasEscalationContacts", v)}
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

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { user } = useAuth();

  if (user?.isSuperAdmin) return <SuperAdminSubscriptionsView />;
  return <BillingView />;
}
