"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Lightbulb, FileText, Sparkles, Info } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { agentsApi, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { NoPlanState } from "@/components/shared/empty-state";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  industryType: z.enum(["accounting_finance", "law", "internal_systems"]),
  agentLanguage: z.enum(["pt-br", "en", "es"]),
  systemPrompt: z.string().min(10),
  userPrompt: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const EXAMPLE_PROMPTS: Record<string, { labelKey: string; promptKey: string }[]> = {
  internal_systems: [
    { labelKey: "agents.examples.customerSupport", promptKey: "agents.examples.customerSupportPrompt" },
    { labelKey: "agents.examples.itHelpdesk", promptKey: "agents.examples.itHelpdeskPrompt" },
    { labelKey: "agents.examples.hrAssistant", promptKey: "agents.examples.hrAssistantPrompt" },
    { labelKey: "agents.examples.onboarding", promptKey: "agents.examples.onboardingPrompt" },
  ],
  law: [
    { labelKey: "agents.examples.legalAdvisor", promptKey: "agents.examples.legalAdvisorPrompt" },
    { labelKey: "agents.examples.contractReview", promptKey: "agents.examples.contractReviewPrompt" },
    { labelKey: "agents.examples.compliance", promptKey: "agents.examples.compliancePrompt" },
    { labelKey: "agents.examples.consumerRights", promptKey: "agents.examples.consumerRightsPrompt" },
  ],
  accounting_finance: [
    { labelKey: "agents.examples.financeHelper", promptKey: "agents.examples.financeHelperPrompt" },
    { labelKey: "agents.examples.taxAdvisor", promptKey: "agents.examples.taxAdvisorPrompt" },
    { labelKey: "agents.examples.invoicing", promptKey: "agents.examples.invoicingPrompt" },
    { labelKey: "agents.examples.payroll", promptKey: "agents.examples.payrollPrompt" },
  ],
};

export default function NewAgentPage() {
  const t = useTranslations();
  const { activeCompanyId } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showNoPlan, setShowNoPlan] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { industryType: "internal_systems", agentLanguage: "pt-br" },
  });

  const selectedIndustry = watch("industryType");
  const currentExamples = EXAMPLE_PROMPTS[selectedIndustry] ?? [];

  function applyExample(example: { labelKey: string; promptKey: string }) {
    setValue("systemPrompt", t(example.promptKey));
  }

  async function onSubmit(data: FormData) {
    if (!activeCompanyId) return;
    setIsLoading(true);
    try {
      const agent = await agentsApi.create(activeCompanyId, data);
      toast({ title: t("common.success") });
      router.push(`/agents/${agent.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        const errData = err.data as Record<string, any> | undefined;
        const msg = errData?.error ?? err.message;
        if (msg.toLowerCase().includes("subscription") || msg.toLowerCase().includes("plan")) {
          setShowNoPlan(true);
        } else if (msg.toLowerCase().includes("agent")) {
          // Plan limit on agents
          toast({ variant: "destructive", title: msg });
        } else {
          toast({ variant: "destructive", title: msg });
        }
      } else {
        toast({ variant: "destructive", title: t("errors.generic") });
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (showNoPlan) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="../agents"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{t("agents.create")}</h1>
        </div>
        <NoPlanState />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../agents"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">{t("agents.create")}</h1>
      </div>

      {/* How it works */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium">{t("agents.howItWorks.title")}</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>{t("agents.howItWorks.step1")}</li>
                <li>{t("agents.howItWorks.step2")}</li>
                <li>{t("agents.howItWorks.step3")}</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("agents.basicInfo")}</CardTitle>
            <CardDescription>{t("agents.basicInfoHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("agents.name")}</Label>
              <Input {...register("name")} placeholder={t("agents.namePlaceholder")} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{t("agents.nameRequired")}</p>}
            </div>
            <div className="space-y-2">
              <Label>
                {t("common.description")}
                <span className="text-muted-foreground ml-1 text-xs">({t("common.optional")})</span>
              </Label>
              <Input {...register("description")} placeholder={t("agents.descriptionPlaceholder")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("agents.industry")}</Label>
                <Select value={watch("industryType")} onValueChange={(v) => setValue("industryType", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accounting_finance">{t("agents.industries.accounting_finance")}</SelectItem>
                    <SelectItem value="law">{t("agents.industries.law")}</SelectItem>
                    <SelectItem value="internal_systems">{t("agents.industries.internal_systems")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("agents.language")}</Label>
                <Select value={watch("agentLanguage")} onValueChange={(v) => setValue("agentLanguage", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-br">{t("agents.languages.pt-br")}</SelectItem>
                    <SelectItem value="en">{t("agents.languages.en")}</SelectItem>
                    <SelectItem value="es">{t("agents.languages.es")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System prompt with examples */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("agents.systemPrompt")}
            </CardTitle>
            <CardDescription>{t("agents.systemPromptHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Example prompt buttons */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("agents.examplePrompts")}
              </p>
              <div className="flex flex-wrap gap-2">
                {currentExamples.map((ex, i) => (
                  <Button
                    key={`${selectedIndustry}-${i}`}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => applyExample(ex)}
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    {t(ex.labelKey)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <textarea
                className="flex min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={t("agents.systemPromptPlaceholder")}
                {...register("systemPrompt")}
                aria-invalid={!!errors.systemPrompt}
              />
              {errors.systemPrompt && (
                <p className="text-xs text-destructive">{t("agents.systemPromptRequired")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                {t("agents.userPrompt")}
                <span className="text-muted-foreground ml-1 text-xs">({t("common.optional")})</span>
              </Label>
              <p className="text-xs text-muted-foreground">{t("agents.userPromptHint")}</p>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={t("agents.userPromptPlaceholder")}
                {...register("userPrompt")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Files hint */}
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 py-4">
            <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{t("agents.filesHint.title")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("agents.filesHint.description")}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">PDF</Badge>
                <Badge variant="secondary" className="text-xs">DOCX</Badge>
                <Badge variant="secondary" className="text-xs">PPTX</Badge>
                <Badge variant="secondary" className="text-xs">XLSX</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="../agents">{t("common.cancel")}</Link>
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
            {t("agents.create")}
          </Button>
        </div>
      </form>
    </div>
  );
}
