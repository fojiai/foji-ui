"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { CreditCard, QrCode, ShieldCheck } from "lucide-react";
import {
  billingApi, apiErrorMessage,
  type BillingActionResult, type BillingCycle, type BillingMethod, type Plan, type PlanChangePreview,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

/**
 * Says, in plain words, what choosing this plan does and what is charged now,
 * before anything happens. Monthly is card only; yearly lets the person pick
 * card or Pix.
 */
export function ChoosePlanDialog({
  companyId,
  plan,
  cycle,
  onOpenChange,
  onDone,
}: {
  companyId: number;
  plan: Plan | null;
  cycle: BillingCycle;
  onOpenChange: (open: boolean) => void;
  onDone: (result: BillingActionResult) => void;
}) {
  const t = useTranslations("billing");
  const tAll = useTranslations();
  const format = useFormatter();
  const [method, setMethod] = useState<BillingMethod>("credit_card");
  const [preview, setPreview] = useState<PlanChangePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (plan) setMethod("credit_card");
  }, [plan, cycle]);

  useEffect(() => {
    if (!plan) return;
    setPreview(null);
    setLoading(true);
    billingApi
      .preview(companyId, { planId: plan.id, cycle, method })
      .then(setPreview)
      .catch((err) => {
        toast({ variant: "destructive", title: apiErrorMessage(err, tAll("errors.generic")) });
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [companyId, plan, cycle, method]); // eslint-disable-line react-hooks/exhaustive-deps

  const money = (v: number) => format.number(v, { style: "currency", currency: "BRL" });
  const date = (iso?: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "long" }) : "");
  const per = cycle === "yearly" ? t("perYearWord") : t("perMonthWord");

  function sentence(p: PlanChangePreview) {
    const vars = { amount: money(p.amountNow), price: money(p.newPrice), per, date: date(p.effectiveAt) };
    switch (p.kind) {
      case "new":
        return method === "pix" ? t("previewNewPix", vars) : t("previewNew", vars);
      case "upgrade":
        return p.amountNow > 0 ? t("previewUpgrade", vars) : t("previewUpgradeFree", vars);
      case "downgrade":
        return t("previewDowngrade", vars);
      case "switch":
        return p.effectiveAt ? t("previewSwitch", vars) : t("previewSwitchNow", vars);
      default:
        return t("previewSame");
    }
  }

  const goesToPayment = preview && (preview.kind === "new" || preview.kind === "switch" || preview.amountNow > 0);

  async function confirm() {
    if (!plan) return;
    setSubmitting(true);
    try {
      const result = await billingApi.choosePlan(companyId, { planId: plan.id, cycle, method });
      if (result.action === "redirect" && result.url) {
        window.location.href = result.url;
        return;
      }
      onDone(result);
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, tAll("errors.generic")) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!plan} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{plan ? t("chooseTitle", { plan: plan.name }) : ""}</DialogTitle>
          <DialogDescription>{cycle === "yearly" ? t("cycleYearly") : t("cycleMonthly")}</DialogDescription>
        </DialogHeader>

        {cycle === "yearly" ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("payWith")}</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("payWith")}>
              {([
                ["credit_card", CreditCard, t("payCard"), t("payCardHint")],
                ["pix", QrCode, t("payPix"), t("payPixHint")],
              ] as const).map(([value, Icon, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={method === value}
                  onClick={() => setMethod(value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60",
                    method === value ? "border-primary ring-1 ring-primary" : "border-input"
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4" aria-hidden="true" /> {label}
                  </span>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4 shrink-0" aria-hidden="true" /> {t("monthlyCardOnly")}
          </p>
        )}

        <div className="min-h-16 rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
          {loading || !preview ? <LoadingSpinner size="sm" /> : sentence(preview)}
        </div>

        {goesToPayment && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {t("secureNote")}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{tAll("common.cancel")}</Button>
          <Button onClick={confirm} disabled={!preview || loading || submitting || preview.kind === "same"}>
            {submitting && <LoadingSpinner size="sm" className="mr-2" />}
            {preview?.kind === "new" || preview?.kind === "switch"
              ? t("goToPayment")
              : preview?.kind === "upgrade" && preview.amountNow > 0
                ? t("payAndChange", { amount: money(preview.amountNow) })
                : t("confirmChange")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
