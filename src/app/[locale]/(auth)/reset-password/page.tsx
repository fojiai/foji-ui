"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Flame } from "lucide-react";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PasswordRequirements } from "@/components/shared/password-requirements";
import { passwordSchema } from "@/lib/validations/password";
import { toast } from "@/hooks/use-toast";

const schema = z
  .object({ password: passwordSchema, confirmPassword: z.string().min(1) })
  .refine((d) => d.password === d.confirmPassword, {
    message: "password_mismatch",
    path: ["confirmPassword"],
  });
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const t = useTranslations();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const passwordValue = watch("password", "");

  async function onSubmit(data: FormData) {
    if (!token) {
      toast({ variant: "destructive", title: "Invalid or missing reset token." });
      return;
    }
    setIsLoading(true);
    try {
      await authApi.resetPassword(token, data.password);
      setDone(true);
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Flame className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>{t("auth.resetPassword")}</CardTitle>
      </CardHeader>
      <CardContent>
        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Password updated successfully. You can now sign in.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">{t("auth.login")}</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("auth.password")}</Label>
              <Input type="password" {...register("password")} aria-invalid={!!errors.password} />
              <PasswordRequirements password={passwordValue} />
            </div>
            <div className="space-y-2">
              <Label>{t("auth.confirmPassword")}</Label>
              <Input type="password" {...register("confirmPassword")} aria-invalid={!!errors.confirmPassword} />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{t("auth.passwordMismatch")}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <LoadingSpinner size="sm" /> : t("auth.resetPassword")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
