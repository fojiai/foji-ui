"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";

const schema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type FormData = z.infer<typeof schema>;

interface PreviewData {
  email: string;
  type: "company" | "system_admin";
  companyName?: string;
  role?: string;
}

export default function AcceptInvitationPage() {
  const t = useTranslations();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Determine invitation type from the URL and load preview
  const isAdminInvite = params.get("type") === "admin";
  const previewUrl = isAdminInvite
    ? `/api/admin/invitations/preview?token=${token}`
    : `/api/invitations/preview?token=${token}`;
  const acceptUrl = isAdminInvite
    ? `/api/admin/invitations/accept`
    : `/api/invitations/accept`;

  useEffect(() => {
    if (!token) { setPreviewLoading(false); return; }
    apiFetch<PreviewData>(previewUrl)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [token, previewUrl]);

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      const resp = await apiFetch<{ token: string }>(acceptUrl, {
        method: "POST",
        body: JSON.stringify({ token, ...data }),
      });
      setToken(resp.token);
      router.push("/dashboard");
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setIsLoading(false);
    }
  }

  if (previewLoading) return (
    <Card className="w-full max-w-md text-center p-8">
      <LoadingSpinner size="lg" label="Loading invitation…" />
    </Card>
  );

  if (!preview) return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle>Invalid invitation</CardTitle>
        <CardDescription>This link is invalid or has expired.</CardDescription>
      </CardHeader>
    </Card>
  );

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          <Image src="/logo-icon.png" alt="Foji AI" width={80} height={80} className="mx-auto rounded-lg" priority />
        </div>
        <CardTitle>Accept invitation</CardTitle>
        <CardDescription>
          {preview.type === "system_admin"
            ? `You've been invited to join Foji AI as a System Admin.`
            : `You've been invited to join ${preview.companyName} as ${preview.role}.`}
          <br />
          <span className="font-medium">{preview.email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("auth.firstName")}</Label>
              <Input {...register("firstName")} aria-invalid={!!errors.firstName} />
            </div>
            <div className="space-y-2">
              <Label>{t("auth.lastName")}</Label>
              <Input {...register("lastName")} aria-invalid={!!errors.lastName} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("auth.password")}</Label>
            <Input type="password" {...register("password")} aria-invalid={!!errors.password} />
            {errors.password && (
              <p className="text-xs text-destructive">{t("auth.passwordMinLength")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t("auth.confirmPassword")}</Label>
            <Input type="password" {...register("confirmPassword")} aria-invalid={!!errors.confirmPassword} />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <LoadingSpinner size="sm" /> : "Create account & join"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
