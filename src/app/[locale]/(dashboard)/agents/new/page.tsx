"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { agentsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
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

export default function NewAgentPage() {
  const t = useTranslations();
  const { activeCompanyId } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { industryType: "internal_systems", agentLanguage: "pt-br" },
  });

  async function onSubmit(data: FormData) {
    if (!activeCompanyId) return;
    setIsLoading(true);
    try {
      const agent = await agentsApi.create(activeCompanyId, data);
      toast({ title: t("common.success") });
      router.push(`/agents/${agent.id}`);
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="../agents"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{t("agents.create")}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Basic Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("agents.name")}</Label>
              <Input {...register("name")} placeholder="e.g. Finance Assistant" aria-invalid={!!errors.name} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.description")}</Label>
              <Input {...register("description")} placeholder="Brief description of this agent" />
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

        <Card>
          <CardHeader><CardTitle className="text-base">Prompts</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("agents.systemPrompt")}</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="You are a helpful financial advisor assistant..."
                {...register("systemPrompt")}
                aria-invalid={!!errors.systemPrompt}
              />
              {errors.systemPrompt && (
                <p className="text-xs text-destructive">System prompt is required (min 10 chars)</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("agents.userPrompt")} <span className="text-muted-foreground">(optional)</span></Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Always cite sources. Keep answers under 3 paragraphs..."
                {...register("userPrompt")}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="../agents">{t("common.cancel")}</Link>
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <LoadingSpinner size="sm" /> : t("agents.create")}
          </Button>
        </div>
      </form>
    </div>
  );
}
