"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { Check, X, Loader2 } from "lucide-react";
import { authApi, plansApi, subscriptionsApi, type Plan } from "@/lib/api";
import { setToken } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Step = "company" | "plan";

const companySchema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
});
type CompanyForm = z.infer<typeof companySchema>;

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function OnboardingPage() {
  const t = useTranslations();
  const router = useRouter();
  const { switchCompany } = useAuth();

  const [step, setStep] = useState<Step>("company");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<CompanyForm>({ resolver: zodResolver(companySchema) });

  const slugValue = watch("slug");

  // Debounced slug availability check
  const checkSlug = useCallback(async (slug: string) => {
    if (!slug || slug.length < 2 || !/^[a-z0-9-]+$/.test(slug)) {
      setSlugStatus(slug && slug.length >= 2 ? "invalid" : "idle");
      return;
    }
    setSlugStatus("checking");
    try {
      const { available } = await authApi.checkSlug(slug);
      setSlugStatus(available ? "available" : "taken");
      if (!available) {
        setError("slug", { message: t("onboarding.slugTaken") });
      } else {
        clearErrors("slug");
      }
    } catch {
      setSlugStatus("idle");
    }
  }, [t, setError, clearErrors]);

  useEffect(() => {
    if (!slugValue) { setSlugStatus("idle"); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkSlug(slugValue), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [slugValue, checkSlug]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setValue("name", val);
    setValue(
      "slug",
      val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    );
  }

  async function onCompanySubmit(data: CompanyForm) {
    if (slugStatus === "taken") {
      setError("slug", { message: t("onboarding.slugTaken") });
      return;
    }
    setIsLoading(true);
    try {
      const company = await authApi.createCompany(data);
      if (company.token) setToken(company.token);
      setCompanyId(company.id);
      switchCompany(company.id);
      const fetchedPlans = await plansApi.list();
      setPlans(fetchedPlans.filter((p) => p.isActive));
      setStep("plan");
    } catch (err: any) {
      const message = err?.data?.error;
      if (message && typeof message === "string" && message.toLowerCase().includes("slug")) {
        setSlugStatus("taken");
        setError("slug", { message: t("onboarding.slugTaken") });
      } else {
        toast({ variant: "destructive", title: t("errors.generic") });
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function onPlanSubmit() {
    if (!companyId) return;
    if (!selectedPlanId) {
      router.push("/dashboard");
      return;
    }
    setIsLoading(true);
    try {
      const { checkoutUrl } = await subscriptionsApi.checkout(companyId, selectedPlanId);
      window.location.href = checkoutUrl;
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4">
          <Image src="/logo-icon.png" alt="Foji AI" width={80} height={80} className="mx-auto rounded-lg" priority />
        </div>
        <h1 className="text-3xl font-bold text-white">{t("onboarding.welcome")}</h1>
        <p className="mt-1 text-zinc-400">{t("onboarding.welcomeSubtitle")}</p>
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-3">
        {(["company", "plan"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                step === s
                  ? "bg-primary text-white"
                  : i < (step === "plan" ? 1 : 0)
                  ? "bg-emerald-500 text-white"
                  : "bg-zinc-800 text-zinc-400"
              )}
            >
              {i < (step === "plan" ? 1 : 0) ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < 1 && <div className="h-px w-12 bg-zinc-700" />}
          </div>
        ))}
      </div>

      {step === "company" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("onboarding.createCompany")}</CardTitle>
            <CardDescription>{t("onboarding.workspaceDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onCompanySubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("onboarding.companyName")}</Label>
                <Input
                  placeholder="Acme Corp"
                  {...register("name")}
                  onChange={handleNameChange}
                  aria-invalid={!!errors.name}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("onboarding.companySlug")}</Label>
                <div className={cn(
                  "flex items-center rounded-md border bg-muted",
                  slugStatus === "taken" ? "border-destructive" : slugStatus === "available" ? "border-emerald-500" : "border-input"
                )}>
                  <span className="px-3 py-2 text-sm text-muted-foreground">foji.ai/</span>
                  <Input
                    className="border-0 bg-transparent focus-visible:ring-0"
                    placeholder="acme-corp"
                    {...register("slug")}
                    aria-invalid={!!errors.slug || slugStatus === "taken"}
                  />
                  <div className="px-3">
                    {slugStatus === "checking" && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {slugStatus === "available" && (
                      <Check className="h-4 w-4 text-emerald-500" />
                    )}
                    {slugStatus === "taken" && (
                      <X className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
                {slugStatus === "taken" && (
                  <p className="text-xs text-destructive">{t("onboarding.slugTaken")}</p>
                )}
                {slugStatus === "available" && (
                  <p className="text-xs text-emerald-500">{t("onboarding.slugAvailable")}</p>
                )}
                {errors.slug && slugStatus !== "taken" && (
                  <p className="text-xs text-destructive">
                    {errors.slug.message === "Invalid" ? t("onboarding.slugInvalid") : errors.slug.message}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || slugStatus === "taken" || slugStatus === "checking"}
              >
                {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                {t("onboarding.continue")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "plan" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("onboarding.selectPlan")}</CardTitle>
              <CardDescription>{t("onboarding.planDescription")}</CardDescription>
            </CardHeader>
          </Card>
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedPlanId === plan.id
                    ? "ring-2 ring-primary"
                    : "hover:border-primary/50"
                )}
              >
                <CardHeader className="text-center">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <p className="text-2xl font-bold">
                    ${plan.monthlyPrice}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("onboarding.upToAgents", { count: plan.maxAgents })}
                  </p>
                  {plan.hasWhatsApp && (
                    <Badge variant="secondary" className="mt-2">WhatsApp</Badge>
                  )}
                  {selectedPlanId === plan.id && (
                    <div className="mt-3 flex justify-center">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1 text-zinc-400" onClick={() => router.push("/dashboard")}>
              {t("onboarding.skipForNow")}
            </Button>
            <Button className="flex-1" onClick={onPlanSubmit} disabled={isLoading}>
              {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
              {selectedPlanId ? t("onboarding.subscribe") : t("onboarding.continueFree")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
