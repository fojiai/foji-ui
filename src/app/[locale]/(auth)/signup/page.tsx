"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PasswordRequirements } from "@/components/shared/password-requirements";
import { passwordSchema } from "@/lib/validations/password";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: passwordSchema,
});
type FormData = z.infer<typeof schema>;

export default function SignupPage() {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const passwordValue = watch("password", "");

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      await authApi.signup(data);
      setSubmittedEmail(data.email);
      setDone(true);
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setIsLoading(false);
    }
  }

  if (done) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4">
            <Image src="/logo-icon.png" alt="Foji AI" width={80} height={80} className="mx-auto rounded-lg" priority />
          </div>
          <CardTitle>{t("auth.verifyEmailTitle")}</CardTitle>
          <CardDescription>
            {t("auth.verifyEmailMessage", { email: submittedEmail })}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
          <Image src="/logo-icon.png" alt="Foji AI" width={80} height={80} className="mx-auto rounded-lg" priority />
        </div>
        <CardTitle>{t("auth.signupTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t("auth.firstName")}</Label>
              <Input id="firstName" {...register("firstName")} aria-invalid={!!errors.firstName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{t("auth.lastName")}</Label>
              <Input id="lastName" {...register("lastName")} aria-invalid={!!errors.lastName} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" type="email" {...register("email")} aria-invalid={!!errors.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              aria-invalid={!!errors.password}
            />
            <PasswordRequirements password={passwordValue} />
          </div>
          <Button
            type="submit"
            className="w-full h-11 text-base font-semibold bg-white text-zinc-900 hover:bg-zinc-200 disabled:bg-zinc-300"
            disabled={isLoading}
          >
            {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
            {t("auth.signup")}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t("auth.hasAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            {t("auth.login")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
