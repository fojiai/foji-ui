"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const t = useTranslations();
  const { login } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      const claims = (await import("@/lib/auth")).getCurrentUser();
      if (claims && claims.companies.length === 0 && !claims.isSuperAdmin) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard");
      }
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Branding */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 shadow-lg backdrop-blur">
          <Image src="/logo-icon.png" alt="Foji AI" width={40} height={40} className="rounded-lg" priority />
        </div>
        <h1 className="text-2xl font-bold text-white">Foji AI</h1>
        <p className="text-sm text-zinc-400">{t("auth.loginSubtitle")}</p>
      </div>

      {/* Card */}
      <Card className="shadow-2xl border-white/10 bg-zinc-900/80 backdrop-blur">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-500"
                {...register("email")}
                aria-invalid={!!errors.email}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-zinc-300">{t("auth.password")}</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  {t("auth.forgotPassword")}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-11 bg-white/5 border-white/10 text-white placeholder:text-zinc-500 pr-10"
                  {...register("password")}
                  aria-invalid={!!errors.password}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-11 w-10 text-zinc-400 hover:text-zinc-200"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              className="h-11 w-full text-base font-semibold bg-white text-zinc-900 hover:bg-zinc-200 disabled:bg-zinc-300"
              disabled={isLoading}
            >
              {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
              {t("auth.login")}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-zinc-400">
            {t("auth.noAccount")}{" "}
            <Link href="/signup" className="text-primary hover:underline font-medium">
              {t("auth.signup")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
