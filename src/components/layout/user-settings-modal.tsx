"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogOut, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PasswordRequirements } from "@/components/shared/password-requirements";
import { passwordSchema as pwSchema } from "@/lib/validations/password";
import { toast } from "@/hooks/use-toast";

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

export function UserSettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = pathname.split("/")[1] || "pt-br";

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
    },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordFormSchema),
  });
  const newPasswordValue = passwordForm.watch("newPassword", "");

  async function onProfileSubmit(data: ProfileForm) {
    setSavingProfile(true);
    try {
      await apiFetch("/api/users/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      toast({ title: t("common.success") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setSavingProfile(false);
    }
  }

  async function onPasswordSubmit(data: PasswordForm) {
    setSavingPassword(true);
    try {
      await apiFetch("/api/users/change-password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      toast({ title: t("common.success") });
      passwordForm.reset();
      setShowPasswordSection(false);
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setSavingPassword(false);
    }
  }

  function changeLocale(locale: string) {
    const newPath = pathname.replace(`/${currentLocale}`, `/${locale}`);
    router.push(newPath);
  }

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.firstName?.[0]?.toUpperCase() ?? "?";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
              {initials}
            </div>
            <div>
              <DialogTitle className="text-left">
                {user?.firstName} {user?.lastName}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Appearance */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {t("userSettings.appearance")}
          </h3>

          <div className="flex items-center justify-between">
            <Label>{t("profile.darkMode")}</Label>
            <Select value={theme ?? "system"} onValueChange={setTheme}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  {t("profile.darkModeOptions.light")}
                </SelectItem>
                <SelectItem value="dark">
                  {t("profile.darkModeOptions.dark")}
                </SelectItem>
                <SelectItem value="system">
                  {t("profile.darkModeOptions.system")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>{t("profile.language")}</Label>
            <Select value={currentLocale} onValueChange={changeLocale}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt-br">Português BR</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Edit name */}
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {t("userSettings.editName")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("auth.firstName")}</Label>
              <Input
                {...profileForm.register("firstName")}
                aria-invalid={!!profileForm.formState.errors.firstName}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("auth.lastName")}</Label>
              <Input
                {...profileForm.register("lastName")}
                aria-invalid={!!profileForm.formState.errors.lastName}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={savingProfile}>
              {savingProfile ? <LoadingSpinner size="sm" /> : t("common.save")}
            </Button>
          </div>
        </form>

        <Separator />

        {/* Change password */}
        <div className="space-y-3">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
          >
            {t("profile.changePassword")}
            {showPasswordSection ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showPasswordSection && (
            <form
              onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label>{t("profile.currentPassword")}</Label>
                <Input
                  type="password"
                  {...passwordForm.register("currentPassword")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("profile.newPassword")}</Label>
                <Input
                  type="password"
                  {...passwordForm.register("newPassword")}
                />
                <PasswordRequirements password={newPasswordValue} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("auth.confirmPassword")}</Label>
                <Input
                  type="password"
                  {...passwordForm.register("confirmPassword")}
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">
                    {t("auth.passwordMismatch")}
                  </p>
                )}
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={savingPassword}>
                  {savingPassword ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    t("profile.changePassword")
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>

        <Separator />

        {/* Logout */}
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => {
            logout();
            onOpenChange(false);
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("userSettings.logout")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
