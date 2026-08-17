"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { EmptyState, NoCompanyState } from "@/components/shared/empty-state";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "@/hooks/use-toast";

// ─── Super Admin: Redirect to Admin panel ────────────────────────────────────

function SuperAdminSettingsView() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) ?? "pt-br";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader eyebrow={t("settings.eyebrow")} title={t("settings.title")} />
      <EmptyState
        eyebrow={t("emptyStates.eyebrowAdmin")}
        title={t("settings.adminOnlyTitle")}
        description={t("superAdmin.platformSettings")}
        action={
          <Button asChild>
            <Link href={`/${locale}/admin`}>
              {t("superAdmin.goToAdmin")}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        }
      />
    </div>
  );
}

// ─── Regular Settings View (tenant-scoped) ───────────────────────────────────

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface CompanyData {
  id: number;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
}

function RegularSettingsView() {
  const t = useTranslations();
  const params = useParams();
  const locale = (params?.locale as string) ?? "pt-br";
  const { activeCompanyId } = useAuth();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (!activeCompanyId) { setIsLoading(false); return; }
    apiFetch<CompanyData>(`/api/companies/${activeCompanyId}`)
      .then((data) => { setCompany(data); reset({ name: data.name, description: data.description ?? "" }); })
      .catch(() => toast({ variant: "destructive", title: t("errors.generic") }))
      .finally(() => setIsLoading(false));
  }, [activeCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: FormData) {
    if (!activeCompanyId) return;
    setIsSaving(true);
    try {
      const updated = await apiFetch<CompanyData>(`/api/companies/${activeCompanyId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      setCompany(updated);
      toast({ title: t("common.success") });
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setIsSaving(false); }
  }

  if (isLoading) return <PageLoader />;
  if (!company) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader eyebrow={t("settings.eyebrow")} title={t("settings.title")} />
        <NoCompanyState />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card className="plate">
          <CardHeader>
            <CardTitle className="type-display text-base">{t("settings.company")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("settings.companyName")}</Label>
              <Input {...register("name")} aria-invalid={!!errors.name} />
            </div>
            <div className="space-y-2">
              <Label>{t("settings.companySlug")}</Label>
              <Input value={company.slug} readOnly className="bg-muted text-muted-foreground cursor-not-allowed" />
              <p className="text-xs text-muted-foreground">{t("settings.slugImmutable")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("common.description")}</Label>
              <Input {...register("description")} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoadingSpinner size="sm" /> : t("common.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Separator />

      {/* The one place destructive is allowed to show as a surface: a section
          whose only content is an irreversible action. */}
      <Card className="plate border-destructive/40">
        <CardHeader>
          <CardTitle className="type-display text-base text-destructive-ink">
            {t("settings.danger")}
          </CardTitle>
          <CardDescription>{t("settings.dangerHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">{t("settings.deleteCompany")}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("settings.deleteConfirmTitle", { name: company.name })}</AlertDialogTitle>
                <AlertDialogDescription>{t("settings.deleteConfirmBody")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {t("settings.deleteConfirmAction")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();

  if (user?.isSuperAdmin) return <SuperAdminSettingsView />;
  return <RegularSettingsView />;
}
