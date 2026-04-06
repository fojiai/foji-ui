"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Copy, RefreshCw, Paperclip, Trash2, Upload, Plus, X, Palette, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { agentsApi, filesApi, subscriptionsApi, type Agent, type AgentFile, type Subscription } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  industryType: z.enum(["accounting_finance", "law", "internal_systems"]),
  agentLanguage: z.enum(["pt-br", "en", "es"]),
  systemPrompt: z.string().min(10),
  userPrompt: z.string().optional(),
  isActive: z.boolean(),
  whatsAppEnabled: z.boolean(),
  whatsAppPhoneNumberId: z.string().optional(),
  supportWhatsAppNumber: z.string().optional(),
  salesWhatsAppNumber: z.string().optional(),
  supportEmail: z.string().email().optional().or(z.literal("")),
  salesEmail: z.string().email().optional().or(z.literal("")),
  welcomeMessage: z.string().max(500).optional(),
  widgetPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
  widgetTitle: z.string().max(100).optional(),
  widgetPlaceholder: z.string().max(200).optional(),
  widgetPosition: z.enum(["left", "right", ""]).optional(),
});
type FormData = z.infer<typeof schema>;

// API returns PascalCase enums (e.g. "AccountingFinance", "PtBr")
// but the form/widget use snake_case/kebab-case ("accounting_finance", "pt-br")
const INDUSTRY_MAP: Record<string, string> = {
  AccountingFinance: "accounting_finance",
  Law: "law",
  InternalSystems: "internal_systems",
};
const LANGUAGE_MAP: Record<string, string> = {
  PtBr: "pt-br",
  En: "en",
  Es: "es",
};

function normalizeIndustry(val: string): string {
  return INDUSTRY_MAP[val] ?? val;
}
function normalizeLanguage(val: string): string {
  return LANGUAGE_MAP[val] ?? val;
}

export default function AgentDetailPage() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const { activeCompanyId } = useAuth();
  const agentId = Number(params.id);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [starters, setStarters] = useState<string[]>([""]);
  const [testKey, setTestKey] = useState(0); // force iframe reload

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function loadAgent() {
    if (!activeCompanyId) { setIsLoading(false); return; }
    try {
      const [a, fileList, sub] = await Promise.all([
        agentsApi.get(activeCompanyId, agentId),
        filesApi.list(agentId),
        subscriptionsApi.getSubscription(activeCompanyId).catch(() => null),
      ]);
      setAgent(a);
      setFiles(fileList);
      setSubscription(sub);

      // Parse conversation starters
      let parsedStarters = [""];
      if (a.conversationStarters) {
        try { parsedStarters = JSON.parse(a.conversationStarters); } catch { /* keep default */ }
        if (!Array.isArray(parsedStarters) || parsedStarters.length === 0) parsedStarters = [""];
      }
      setStarters(parsedStarters);

      reset({
        name: a.name,
        description: a.description ?? "",
        industryType: normalizeIndustry(a.industryType) as any,
        agentLanguage: normalizeLanguage(a.agentLanguage) as any,
        systemPrompt: a.systemPrompt,
        userPrompt: a.userPrompt ?? "",
        isActive: a.isActive,
        whatsAppEnabled: a.whatsAppEnabled,
        whatsAppPhoneNumberId: a.whatsAppPhoneNumberId ?? "",
        supportWhatsAppNumber: a.supportWhatsAppNumber ?? "",
        salesWhatsAppNumber: a.salesWhatsAppNumber ?? "",
        supportEmail: a.supportEmail ?? "",
        salesEmail: a.salesEmail ?? "",
        welcomeMessage: a.welcomeMessage ?? "",
        widgetPrimaryColor: a.widgetPrimaryColor ?? "",
        widgetTitle: a.widgetTitle ?? "",
        widgetPlaceholder: a.widgetPlaceholder ?? "",
        widgetPosition: (a.widgetPosition as "left" | "right" | "") ?? "",
      });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadAgent(); }, [activeCompanyId, agentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: FormData) {
    if (!activeCompanyId) return;
    setIsSaving(true);
    try {
      // Convert empty strings to null so .NET doesn't validate "" as an invalid email/etc
      const cleaned = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
      );
      const payload: any = {
        ...cleaned,
        conversationStarters: JSON.stringify(starters.filter((s) => s.trim())),
      };
      const updated = await agentsApi.update(activeCompanyId, agentId, payload);
      setAgent(updated);
      setTestKey((k) => k + 1); // reload test iframe
      toast({ title: t("common.success") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRegenerate() {
    if (!activeCompanyId) return;
    setIsRegenerating(true);
    try {
      const { agentToken } = await agentsApi.regenerateToken(activeCompanyId, agentId);
      setAgent((prev) => prev ? { ...prev, agentToken } : prev);
      toast({ title: t("agents.detail.tokenRegenerated") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleDeleteAgent() {
    if (!activeCompanyId) return;
    try {
      await agentsApi.delete(activeCompanyId, agentId);
      toast({ title: t("agents.detail.agentDeleted") });
      router.push("/agents");
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (file.size > 30 * 1024 * 1024) {
      toast({ variant: "destructive", title: t("files.sizeExceeded") });
      return;
    }
    setUploadingFile(true);
    try {
      const uploaded = await filesApi.upload(agentId, file);
      setFiles((prev) => [uploaded, ...prev]);
      toast({ title: t("files.uploadSuccess") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  }

  async function handleDeleteFile(fileId: number) {
    try {
      await filesApi.delete(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast({ title: t("common.success") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  function addStarter() {
    if (starters.length < 4) setStarters([...starters, ""]);
  }

  function removeStarter(index: number) {
    setStarters(starters.filter((_, i) => i !== index));
  }

  function updateStarter(index: number, value: string) {
    setStarters(starters.map((s, i) => (i === index ? value : s)));
  }

  const embedCode = agent
    ? `<script src="${process.env.NEXT_PUBLIC_WIDGET_URL}/widget.js" data-agent-token="${agent.agentToken}" async></script>`
    : "";

  const testUrl = agent
    ? `${process.env.NEXT_PUBLIC_WIDGET_URL}/test.html?token=${agent.agentToken}&api=${encodeURIComponent(process.env.NEXT_PUBLIC_AI_API_URL || "")}`
    : "";

  const statusVariant: Record<string, any> = {
    Ready: "success",
    Processing: "warning",
    Failed: "destructive",
    Pending: "outline",
  };

  if (isLoading) return <PageLoader />;
  if (!agent) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/agents"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
            <Badge variant={agent.isActive ? "success" : "outline"} className="mt-0.5">
              {agent.isActive ? t("agents.status.active") : t("agents.status.inactive")}
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="w-full">
          <TabsTrigger value="settings" className="flex-1">{t("agents.detail.settings")}</TabsTrigger>
          <TabsTrigger value="files" className="flex-1">{t("agents.detail.files", { count: files.length })}</TabsTrigger>
          <TabsTrigger value="embed" className="flex-1">{t("agents.detail.embed")}</TabsTrigger>
          <TabsTrigger value="test" className="flex-1">{t("agents.detail.test")}</TabsTrigger>
        </TabsList>

        {/* ── Settings ─────────────────────────────────────────────────── */}
        <TabsContent value="settings" className="mt-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">{t("agents.basicInfo")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>{t("common.active")}</Label>
                  <Switch
                    checked={watch("isActive")}
                    onCheckedChange={(v) => setValue("isActive", v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("agents.name")}</Label>
                  <Input {...register("name")} aria-invalid={!!errors.name} />
                </div>
                <div className="space-y-2">
                  <Label>{t("common.description")}</Label>
                  <Input {...register("description")} />
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
              <CardHeader><CardTitle className="text-base">{t("agents.detail.prompts")}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("agents.systemPrompt")}</Label>
                  <textarea
                    className="flex min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    {...register("systemPrompt")}
                    aria-invalid={!!errors.systemPrompt}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("agents.userPrompt")} <span className="text-muted-foreground">({t("common.optional")})</span></Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    {...register("userPrompt")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Welcome Message */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  {t("agents.welcomeMessage.title")}
                </CardTitle>
                <CardDescription>{t("agents.welcomeMessage.hint")}</CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder={t("agents.welcomeMessage.placeholder")}
                  {...register("welcomeMessage")}
                />
              </CardContent>
            </Card>

            {/* Conversation Starters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("agents.starters.title")}</CardTitle>
                <CardDescription>{t("agents.starters.hint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {starters.map((starter, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={starter}
                      onChange={(e) => updateStarter(i, e.target.value)}
                      placeholder={t("agents.starters.placeholder")}
                    />
                    {starters.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeStarter(i)} className="shrink-0">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {starters.length < 4 && (
                  <Button type="button" variant="outline" size="sm" onClick={addStarter}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> {t("agents.starters.add")}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Widget Appearance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  {t("agents.appearance.title")}
                </CardTitle>
                <CardDescription>{t("agents.appearance.hint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("agents.appearance.primaryColor")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        {...register("widgetPrimaryColor")}
                        placeholder="#FF2D2D"
                        className="font-mono"
                        onChange={(e) => {
                          let v = e.target.value;
                          if (v && !v.startsWith("#")) v = "#" + v;
                          setValue("widgetPrimaryColor", v);
                        }}
                      />
                      {watch("widgetPrimaryColor") && /^#[0-9a-fA-F]{6}$/.test(watch("widgetPrimaryColor") ?? "") && (
                        <div
                          className="h-9 w-9 rounded-md border border-input shrink-0"
                          style={{ backgroundColor: watch("widgetPrimaryColor") }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("agents.appearance.position")}</Label>
                    <Select value={watch("widgetPosition") || ""} onValueChange={(v) => setValue("widgetPosition", v as any)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="right">{t("agents.appearance.positionRight")}</SelectItem>
                        <SelectItem value="left">{t("agents.appearance.positionLeft")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("agents.appearance.widgetTitle")}</Label>
                    <Input {...register("widgetTitle")} placeholder={t("agents.appearance.widgetTitlePlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("agents.appearance.widgetPlaceholder")}</Label>
                    <Input {...register("widgetPlaceholder")} placeholder={t("agents.appearance.widgetPlaceholderDefault")} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {subscription?.plan?.hasWhatsApp ? (
              <Card>
                <CardHeader><CardTitle className="text-base">{t("agents.whatsapp.title")}</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{t("agents.whatsapp.enable")}</p>
                    </div>
                    <Switch
                      checked={watch("whatsAppEnabled")}
                      onCheckedChange={(v) => setValue("whatsAppEnabled", v)}
                    />
                  </div>
                  {watch("whatsAppEnabled") && (
                    <div className="space-y-2">
                      <Label>{t("agents.whatsapp.phoneNumberId")}</Label>
                      <p className="text-xs text-muted-foreground">{t("agents.whatsapp.phoneNumberHint")}</p>
                      <Input
                        {...register("whatsAppPhoneNumberId")}
                        placeholder="+5511999999999"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-medium">{t("agents.whatsapp.title")}</p>
                    <p className="text-xs text-muted-foreground">{t("agents.whatsapp.requiresPlan")}</p>
                  </div>
                  <Badge variant="outline">{t("billing.upgrade")}</Badge>
                </CardContent>
              </Card>
            )}

            {subscription?.plan?.hasEscalationContacts ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("agents.escalation.title")}</CardTitle>
                  <p className="text-xs text-muted-foreground">{t("agents.escalation.hint")}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("agents.escalation.supportWhatsApp")}</Label>
                      <Input {...register("supportWhatsAppNumber")} placeholder="+5511999999999" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("agents.escalation.salesWhatsApp")}</Label>
                      <Input {...register("salesWhatsAppNumber")} placeholder="+5511888888888" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("agents.escalation.supportEmail")}</Label>
                      <Input {...register("supportEmail")} type="email" placeholder="support@company.com" aria-invalid={!!errors.supportEmail} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("agents.escalation.salesEmail")}</Label>
                      <Input {...register("salesEmail")} type="email" placeholder="sales@company.com" aria-invalid={!!errors.salesEmail} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-medium">{t("agents.escalation.title")}</p>
                    <p className="text-xs text-muted-foreground">{t("agents.escalation.upgradeProfessional")}</p>
                  </div>
                  <Badge variant="outline">{t("billing.upgrade")}</Badge>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> {t("agents.detail.delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("agents.detail.deleteTitle", { name: agent.name })}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("agents.detail.deleteDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAgent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {t("common.delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? <LoadingSpinner size="sm" /> : t("common.save")}
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ── Files ─────────────────────────────────────────────────────── */}
        <TabsContent value="files" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-6">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-input p-8 transition-colors hover:border-primary/50">
                {uploadingFile ? (
                  <LoadingSpinner size="md" label={t("files.uploading")} />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm font-medium">{t("files.dropzone")}</p>
                      <p className="text-xs text-muted-foreground">{t("files.supportedFormats")} · {t("files.maxSize")}</p>
                    </div>
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf,.docx,.pptx,.xlsx"
                      onChange={handleFileUpload}
                    />
                  </>
                )}
              </label>
            </CardContent>
          </Card>

          {files.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <Paperclip className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t("files.empty")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <Card key={file.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{file.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant[file.processingStatus] ?? "outline"}>
                        {t(`files.${file.processingStatus.toLowerCase()}` as any) ?? file.processingStatus}
                      </Badge>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("files.deleteTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("files.deleteDescription", { fileName: file.fileName })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteFile(file.id)}>
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Embed ─────────────────────────────────────────────────────── */}
        <TabsContent value="embed" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("agents.embedCode")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
                  {embedCode}
                </pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2"
                  onClick={() => { navigator.clipboard.writeText(embedCode); toast({ title: t("common.copied") }); }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("agents.detail.embedHint")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t("agents.detail.agentToken")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input readOnly value={agent.agentToken} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => { navigator.clipboard.writeText(agent.agentToken); toast({ title: t("common.copied") }); }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> {t("agents.regenerateToken")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("agents.detail.regenerateTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("agents.detail.regenerateDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRegenerate} disabled={isRegenerating}>
                      {isRegenerating ? <LoadingSpinner size="sm" /> : t("agents.detail.regenerate")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Test ──────────────────────────────────────────────────────── */}
        <TabsContent value="test" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("agents.detail.testTitle")}</CardTitle>
              <CardDescription>{t("agents.detail.testDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-[500px]">
                <iframe
                  key={`${agent.agentToken}-${testKey}`}
                  src={testUrl}
                  className="w-full rounded-xl border border-input overflow-hidden"
                  style={{ height: "700px" }}
                  title="Agent test chat"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
