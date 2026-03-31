"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PasswordRequirements } from "@/components/shared/password-requirements";
import { passwordSchema as pwSchema } from "@/lib/validations/password";
import { toast } from "@/hooks/use-toast";
import { useRouter, usePathname } from "next/navigation";

const profileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: pwSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "password_mismatch",
    path: ["confirmPassword"],
  });
type PasswordForm = z.infer<typeof passwordFormSchema>;

export default function ProfilePage() {
  const t = useTranslations();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = pathname.split("/")[1] || "pt-br";

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: user?.firstName ?? "", lastName: user?.lastName ?? "" },
  });

  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordFormSchema) });
  const newPasswordValue = passwordForm.watch("newPassword", "");

  async function onProfileSubmit(data: ProfileForm) {
    setSavingProfile(true);
    try {
      await apiFetch("/api/users/profile", { method: "PUT", body: JSON.stringify(data) });
      toast({ title: t("common.success") });
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setSavingProfile(false); }
  }

  async function onPasswordSubmit(data: PasswordForm) {
    setSavingPassword(true);
    try {
      await apiFetch("/api/users/change-password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
      });
      toast({ title: "Password updated" });
      passwordForm.reset();
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setSavingPassword(false); }
  }

  function changeLocale(locale: string) {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`);
    router.push(newPath);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("profile.title")}</h1>

      <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("profile.personalInfo")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("auth.firstName")}</Label>
                <Input {...profileForm.register("firstName")} aria-invalid={!!profileForm.formState.errors.firstName} />
              </div>
              <div className="space-y-2">
                <Label>{t("auth.lastName")}</Label>
                <Input {...profileForm.register("lastName")} aria-invalid={!!profileForm.formState.errors.lastName} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("auth.email")}</Label>
              <Input value={user?.email ?? ""} readOnly className="bg-muted text-muted-foreground cursor-not-allowed" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? <LoadingSpinner size="sm" /> : t("common.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("profile.preferences")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t("profile.darkMode")}</Label>
            <Select value={theme ?? "system"} onValueChange={setTheme}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t("profile.darkModeOptions.light")}</SelectItem>
                <SelectItem value="dark">{t("profile.darkModeOptions.dark")}</SelectItem>
                <SelectItem value="system">{t("profile.darkModeOptions.system")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label>{t("profile.language")}</Label>
            <Select value={currentLocale} onValueChange={changeLocale}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-br">Português BR</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("profile.changePassword")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("profile.currentPassword")}</Label>
              <Input type="password" {...passwordForm.register("currentPassword")} />
            </div>
            <div className="space-y-2">
              <Label>{t("profile.newPassword")}</Label>
              <Input type="password" {...passwordForm.register("newPassword")} />
              <PasswordRequirements password={newPasswordValue} />
            </div>
            <div className="space-y-2">
              <Label>{t("auth.confirmPassword")}</Label>
              <Input type="password" {...passwordForm.register("confirmPassword")} />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive">{t("auth.passwordMismatch")}</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? <LoadingSpinner size="sm" /> : t("profile.changePassword")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
