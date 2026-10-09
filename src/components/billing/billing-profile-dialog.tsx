"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { billingApi, apiErrorMessage, type BillingProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";
import { isValidCpfCnpj, maskCpfCnpj } from "./cpf-cnpj";

/**
 * Who pays: Asaas requires a CPF or CNPJ for every customer, and the NFS-e is
 * issued in this name. Asked once, right before the first payment.
 */
export function BillingProfileDialog({
  open,
  onOpenChange,
  companyId,
  profile,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  profile: BillingProfile | null;
  onSaved: (profile: BillingProfile) => void;
}) {
  const t = useTranslations("billing");
  const tAll = useTranslations();
  const schema = z.object({
    name: z.string().trim().min(2, t("profileNameRequired")),
    cpfCnpj: z.string().refine(isValidCpfCnpj, t("profileInvalid")),
  });
  type Form = z.infer<typeof schema>;
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: "", cpfCnpj: "" } });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) form.reset({ name: profile?.name ?? "", cpfCnpj: profile?.cpfCnpj ? maskCpfCnpj(profile.cpfCnpj) : "" });
  }, [open, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(values: Form) {
    setSaving(true);
    try {
      const saved = await billingApi.updateProfile(companyId, values);
      toast({ title: t("profileSaved") });
      onSaved(saved);
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, tAll("errors.generic")) });
    } finally {
      setSaving(false);
    }
  }

  const errors = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("profileTitle")}</DialogTitle>
          <DialogDescription>{t("profileDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="billing-name">{t("profileName")}</Label>
            <Input id="billing-name" autoComplete="name" {...form.register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive-ink">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="billing-doc">{t("profileDocument")}</Label>
            <Input
              id="billing-doc"
              inputMode="numeric"
              placeholder="000.000.000-00"
              {...form.register("cpfCnpj", {
                onChange: (e) => form.setValue("cpfCnpj", maskCpfCnpj(e.target.value)),
              })}
              aria-invalid={!!errors.cpfCnpj}
            />
            {errors.cpfCnpj ? (
              <p className="text-xs text-destructive-ink">{errors.cpfCnpj.message}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t("profileDocumentHint")}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <LoadingSpinner size="sm" className="mr-2" />}
              {t("profileSave")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
