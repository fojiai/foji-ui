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
import { apiFetch, companiesApi, apiErrorMessage } from "@/lib/api";
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
  const { activeCompanyId, user, logout } = useAuth();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner =
    user?.companies?.find((c) => c.companyId === activeCompanyId)?.role === "owner";
  const canDelete = confirmName.trim() === company?.name.trim();

  async function deleteCompany() {
    if (!activeCompanyId || !canDelete) return;
    setIsDeleting(true);
    try {
      await companiesApi.delete(activeCompanyId);
      toast({ title: t("settings.deleteSuccess") });
      // The company list is baked into the JWT and there is no refresh
      // endpoint, so the token still names a workspace that no longer exists.
      // Ending the session is the only way back to a consistent state.
      logout();
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
      setIsDeleting(false);
    }
  }

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

      {/* Owners only. The API returns 403 for anyone else, so showing the
          control to an admin would just be a button that always fails. */}
      {isOwner && (
        <Card className="plate border-destructive/40">
          <CardHeader>
            <CardTitle className="type-display text-base text-destructive-ink">
              {t("settings.danger")}
            </CardTitle>
            <CardDescription>{t("settings.dangerHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog
              open={deleteOpen}
              onOpenChange={(open) => { setDeleteOpen(open); if (!open) setConfirmName(""); }}
            >
              <AlertDialogTrigger asChild>
                <Button variant="destructive">{t("settings.deleteCompany")}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("settings.deleteConfirmTitle", { name: company.name })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>{t("settings.deleteConfirmBody")}</AlertDialogDescription>
                </AlertDialogHeader>

                {/* Type-to-confirm. This deletes every agent, file and
                    conversation with no undo, so a single click is too cheap
                    a gesture for it. */}
                <div className="space-y-2">
                  <Label htmlFor="delete-confirm">
                    {t("settings.deleteConfirmPrompt", { name: company.name })}
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    autoComplete="off"
                    aria-invalid={confirmName.length > 0 && !canDelete}
                  />
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={!canDelete || isDeleting}
                    onClick={(e) => { e.preventDefault(); deleteCompany(); }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting && <LoadingSpinner size="sm" className="mr-2" />}
                    {t("settings.deleteConfirmAction")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();

  if (user?.isSuperAdmin) return <SuperAdminSettingsView />;
  return <RegularSettingsView />;
}
