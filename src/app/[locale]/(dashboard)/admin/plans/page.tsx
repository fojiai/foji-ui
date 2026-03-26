"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, Check, X, Lock, Globe } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { plansApi, type Plan } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  monthlyPriceUsd: z.coerce.number().min(0),
  stripePriceId: z.string().optional(),
  maxAgents: z.coerce.number().int().min(1),
  hasWhatsApp: z.boolean(),
  hasEscalationContacts: z.boolean(),
  maxConversationsPerMonth: z.coerce.number().int().min(0),
  maxMessagesPerMonth: z.coerce.number().int().min(0),
  isActive: z.boolean(),
  isPublic: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export default function PlansPage() {
  const t = useTranslations();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isActive: true, hasWhatsApp: false, hasEscalationContacts: false, monthlyPriceUsd: 0, maxAgents: 2, maxConversationsPerMonth: 0, maxMessagesPerMonth: 0, isPublic: true },
  });

  async function load() {
    setIsLoading(true);
    try { setPlans(await plansApi.listAll()); } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setEditing(null);
    reset({ isActive: true, hasWhatsApp: false, hasEscalationContacts: false, monthlyPriceUsd: 0, maxAgents: 2, maxConversationsPerMonth: 0, maxMessagesPerMonth: 0, isPublic: true });
    setDialogOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditing(plan);
    reset({ ...plan });
    setDialogOpen(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      if (editing) {
        await plansApi.update(editing.id, data);
      } else {
        await plansApi.create(data);
      }
      toast({ title: t("common.success") });
      setDialogOpen(false);
      await load();
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setSaving(false); }
  }

  async function deletePlan(id: number) {
    try {
      await plansApi.delete(id);
      toast({ title: t("common.success") });
      setPlans((prev) => prev.filter((p) => p.id !== id));
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("admin.plans.title")}</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> {t("admin.plans.create")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.isActive ? "" : "opacity-60"}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                <div className="flex items-center gap-1.5">
                  {plan.isPublic === false ? (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Lock className="h-3 w-3" /> {t("admin.plans.private")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-xs text-emerald-600">
                      <Globe className="h-3 w-3" /> {t("admin.plans.public")}
                    </Badge>
                  )}
                  <Badge variant={plan.isActive ? "success" : "outline"}>
                    {plan.isActive ? t("common.active") : t("common.inactive")}
                  </Badge>
                </div>
              </div>
              <p className="font-mono text-xs text-muted-foreground">{plan.slug}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-bold">
                ${plan.monthlyPriceUsd}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("admin.plans.maxAgents")}</span>
                  <span className="font-medium">{plan.maxAgents}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("admin.plans.hasWhatsApp")}</span>
                  {plan.hasWhatsApp ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("admin.plans.hasEscalationContacts")}</span>
                  {plan.hasEscalationContacts ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("admin.plans.maxConversations")}</span>
                  <span className="font-medium">{plan.maxConversationsPerMonth === 0 ? "∞" : plan.maxConversationsPerMonth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("admin.plans.stripePriceId")}</span>
                  <span className="max-w-[120px] truncate font-mono text-xs">{plan.stripePriceId}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(plan)}>
                  <Pencil className="mr-1 h-3 w-3" /> {t("common.edit")}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("common.confirm")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        Delete <strong>{plan.name}</strong>?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deletePlan(plan.id)}>
                        {t("common.delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("common.edit") : t("admin.plans.create")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("common.name")}</Label>
                <Input {...register("name")} aria-invalid={!!errors.name} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.plans.slug")}</Label>
                <Input {...register("slug")} placeholder="starter" aria-invalid={!!errors.slug} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.plans.monthlyPrice")}</Label>
                <Input type="number" step="0.01" {...register("monthlyPriceUsd")} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.plans.maxAgents")}</Label>
                <Input type="number" {...register("maxAgents")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                {t("admin.plans.stripePriceId")}
                <span className="ml-1 text-xs text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input {...register("stripePriceId")} placeholder="price_xxx" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.plans.maxConversations")}</Label>
                <Input type="number" {...register("maxConversationsPerMonth")} placeholder="0 = unlimited" />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.plans.maxMessages")}</Label>
                <Input type="number" {...register("maxMessagesPerMonth")} placeholder="0 = unlimited" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("admin.plans.hasWhatsApp")}</Label>
              <Switch
                checked={watch("hasWhatsApp")}
                onCheckedChange={(v) => setValue("hasWhatsApp", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("admin.plans.hasEscalationContacts")}</Label>
              <Switch
                checked={watch("hasEscalationContacts")}
                onCheckedChange={(v) => setValue("hasEscalationContacts", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("admin.plans.publicPlan")}</Label>
                <p className="text-xs text-muted-foreground">{t("admin.plans.publicPlanHint")}</p>
              </div>
              <Switch
                checked={watch("isPublic")}
                onCheckedChange={(v) => setValue("isPublic", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t("common.active")}</Label>
              <Switch
                checked={watch("isActive")}
                onCheckedChange={(v) => setValue("isActive", v)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <LoadingSpinner size="sm" /> : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
