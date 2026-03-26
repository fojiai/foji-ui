"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Building2, User, Pencil, Trash2, CalendarClock, Lock, Globe } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { adminCompaniesApi, plansApi, type AdminCompanyDetail, type Plan } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";

// ── Assign Plan form ──────────────────────────────────────────────────────────

const assignSchema = z.object({
  planId: z.coerce.number().min(1),
  adminNotes: z.string().optional(),
  periodEnd: z.string().optional(), // ISO date string or empty
});
type AssignForm = z.infer<typeof assignSchema>;

// ── Notes form ────────────────────────────────────────────────────────────────

const notesSchema = z.object({ notes: z.string() });
type NotesForm = z.infer<typeof notesSchema>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminCompanyDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const companyId = Number(params.id);

  const [company, setCompany] = useState<AdminCompanyDetail | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const assignForm = useForm<AssignForm>({
    resolver: zodResolver(assignSchema),
    defaultValues: { adminNotes: "", periodEnd: "" },
  });

  const notesForm = useForm<NotesForm>({
    resolver: zodResolver(notesSchema),
  });

  async function load() {
    try {
      const [comp, plans] = await Promise.all([
        adminCompaniesApi.get(companyId),
        plansApi.listAll(),
      ]);
      setCompany(comp);
      setAllPlans(plans);
      notesForm.reset({ notes: comp.adminNotes ?? "" });
      if (comp.currentPlanId) assignForm.setValue("planId", comp.currentPlanId);
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { load(); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onAssignPlan(data: AssignForm) {
    setAssigning(true);
    try {
      await adminCompaniesApi.assignPlan(
        companyId,
        data.planId,
        data.adminNotes || undefined,
        data.periodEnd || undefined
      );
      toast({ title: "Plan assigned successfully" });
      setAssignDialogOpen(false);
      await load();
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setAssigning(false); }
  }

  async function onRemovePlan() {
    try {
      await adminCompaniesApi.removePlan(companyId);
      toast({ title: "Plan removed" });
      await load();
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
  }

  async function onSaveNotes(data: NotesForm) {
    setSavingNotes(true);
    try {
      await adminCompaniesApi.updateNotes(companyId, data.notes || null);
      toast({ title: t("common.success") });
      setEditingNotes(false);
      await load();
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setSavingNotes(false); }
  }

  if (isLoading) return <PageLoader />;
  if (!company) return null;

  const publicPlans = allPlans.filter((p) => p.isPublic && p.isActive);
  const privatePlans = allPlans.filter((p) => !p.isPublic && p.isActive);

  const statusVariant: Record<string, any> = {
    Active: "success",
    Trialing: "warning",
    PastDue: "destructive",
    Canceled: "outline",
    Unpaid: "destructive",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/companies"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
            {company.accountType === "Individual"
              ? <User className="h-5 w-5 text-primary" />
              : <Building2 className="h-5 w-5 text-primary" />
            }
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{company.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{company.slug}</span>
              <Badge variant={company.accountType === "Individual" ? "secondary" : "outline"} className="text-xs">
                {company.accountType === "Individual" ? "Pessoa Física" : "Pessoa Jurídica"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Account info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Account Info</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {company.tradeName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trade name</span>
                <span className="font-medium">{company.tradeName}</span>
              </div>
            )}
            {company.cpfCnpj && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{company.accountType === "Individual" ? "CPF" : "CNPJ"}</span>
                <span className="font-mono">{company.cpfCnpj}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Members</span>
              <span>{company.memberCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agents</span>
              <span>{company.agentCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(company.createdAt).toLocaleDateString()}</span>
            </div>
            {company.stripeCustomerId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stripe</span>
                <span className="font-mono text-xs">{company.stripeCustomerId}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Subscription</CardTitle>
              <Button size="sm" onClick={() => {
                if (company.currentPlanId) assignForm.setValue("planId", company.currentPlanId);
                assignForm.setValue("adminNotes", company.subscriptionAdminNotes ?? "");
                setAssignDialogOpen(true);
              }}>
                {company.currentPlanId ? "Change Plan" : "Assign Plan"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {company.currentPlanId ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{company.currentPlanName}</span>
                    {company.currentPlanIsPublic === false && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Lock className="h-2.5 w-2.5" /> Custom
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={statusVariant[company.subscriptionStatus ?? ""] ?? "outline"}>
                    {company.subscriptionStatus}
                  </Badge>
                </div>
                {company.subscriptionPeriodEnd && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Period end</span>
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {new Date(company.subscriptionPeriodEnd).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {company.subscriptionAssignedByAdminId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Source</span>
                    <Badge variant="outline" className="text-xs">Admin-assigned</Badge>
                  </div>
                )}
                {company.subscriptionAdminNotes && (
                  <p className="text-xs text-muted-foreground italic border-t pt-2 mt-2">
                    {company.subscriptionAdminNotes}
                  </p>
                )}
                <Separator className="my-2" />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive">
                      <Trash2 className="mr-2 h-3 w-3" /> Remove plan
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove plan?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will cancel the active subscription for <strong>{company.name}</strong>. They will lose access to plan features immediately.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={onRemovePlan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <p className="text-muted-foreground">No active plan</p>
                <p className="text-xs text-muted-foreground">Assign a plan to grant this account access.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admin notes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Admin Notes</CardTitle>
            {!editingNotes && (
              <Button variant="ghost" size="sm" onClick={() => setEditingNotes(true)}>
                <Pencil className="mr-1 h-3 w-3" /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingNotes ? (
            <form onSubmit={notesForm.handleSubmit(onSaveNotes)} className="space-y-3">
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Payment arrangement, custom deal, referral source…"
                {...notesForm.register("notes")}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingNotes(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={savingNotes}>
                  {savingNotes ? <LoadingSpinner size="sm" /> : t("common.save")}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              {company.adminNotes || <span className="italic">No notes.</span>}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Assign / Change Plan dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {company.currentPlanId ? "Change Plan" : "Assign Plan"} — {company.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={assignForm.handleSubmit(onAssignPlan)} className="space-y-4">

            {/* Public plans */}
            {publicPlans.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Public Plans
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  {publicPlans.map((p) => (
                    <label
                      key={p.id}
                      className={`flex cursor-pointer items-center justify-between rounded-md border px-4 py-3 transition-colors ${
                        Number(assignForm.watch("planId")) === p.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          className="sr-only"
                          value={p.id}
                          {...assignForm.register("planId")}
                        />
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.maxAgents} agents · ${p.monthlyPriceUsd}/mo</p>
                        </div>
                      </div>
                      {p.hasWhatsApp && <Badge variant="secondary" className="text-xs">WhatsApp</Badge>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Private/custom plans */}
            {privatePlans.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Custom Plans
                </Label>
                <div className="grid grid-cols-1 gap-2">
                  {privatePlans.map((p) => (
                    <label
                      key={p.id}
                      className={`flex cursor-pointer items-center justify-between rounded-md border px-4 py-3 transition-colors ${
                        Number(assignForm.watch("planId")) === p.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          className="sr-only"
                          value={p.id}
                          {...assignForm.register("planId")}
                        />
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.maxAgents} agents · ${p.monthlyPriceUsd}/mo</p>
                        </div>
                      </div>
                      {p.customForCompanyId === company.id && (
                        <Badge variant="secondary" className="text-xs">Exclusive</Badge>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" /> Period End
                <span className="text-xs text-muted-foreground ml-1">(leave blank = no expiry)</span>
              </Label>
              <Input type="date" {...assignForm.register("periodEnd")} />
            </div>

            <div className="space-y-2">
              <Label>Notes for this assignment</Label>
              <textarea
                className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="e.g. Paying via monthly PIX. Invoice sent 1st of each month."
                {...assignForm.register("adminNotes")}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssignDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={assigning}>
                {assigning ? <LoadingSpinner size="sm" /> : "Assign Plan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
