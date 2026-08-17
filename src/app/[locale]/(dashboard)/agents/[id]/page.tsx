"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Calendar, Copy, RefreshCw, Paperclip, Trash2, Upload, Plus, X, Palette, MessageCircle, UserPlus, PhoneForwarded } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import { agentsApi, calendarApi, filesApi, subscriptionsApi, whatsAppOnboardingApi, type Agent, type AgentFile, type Subscription, apiErrorMessage } from "@/lib/api";
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
import { PageHeader } from "@/components/shared/page-header";
import { ConnectWhatsAppButton } from "@/components/agents/connect-whatsapp-button";
import { EmptyState } from "@/components/shared/empty-state";
import { HeatStatus } from "@/components/shared/heat";
import { PhoneInput } from "@/components/shared/phone-input";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  industryType: z.enum(["accounting_finance", "law", "internal_systems", "general_assistant"]),
  agentLanguage: z.enum(["pt-br", "en", "es"]),
  systemPrompt: z.string().min(10),
  userPrompt: z.string().optional(),
  isActive: z.boolean(),
  whatsAppEnabled: z.boolean(),
  whatsAppPhoneNumberId: z.string().optional(),
  whatsAppAccessToken: z.string().optional(),
  whatsAppMode: z.enum(["Agent", "Inbox"]).optional(),
  supportWhatsAppNumber: z.string().optional(),
  salesWhatsAppNumber: z.string().optional(),
  supportEmail: z.string().email().optional().or(z.literal("")),
  salesEmail: z.string().email().optional().or(z.literal("")),
  welcomeMessage: z.string().max(500).optional(),
  widgetPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
  widgetTitle: z.string().max(100).optional(),
  widgetPlaceholder: z.string().max(200).optional(),
  widgetPosition: z.enum(["left", "right", ""]).optional(),
  responseStyle: z.enum(["Professional", "Friendly", "Concise", ""]).optional(),
  leadCaptureEnabled: z.boolean(),
  leadCapturePrompt: z.string().max(500).optional(),
  handoffEnabled: z.boolean(),
  handoffNotifyEmail: z.string().email().optional().or(z.literal("")),
  handoffNotifyWhatsApp: z.string().optional(),
  handoffMessage: z.string().max(500).optional(),
});
type FormData = z.infer<typeof schema>;

// API returns PascalCase enums (e.g. "AccountingFinance", "PtBr")
// but the form/widget use snake_case/kebab-case ("accounting_finance", "pt-br")
const INDUSTRY_MAP: Record<string, string> = {
  AccountingFinance: "accounting_finance",
  Law: "law",
  InternalSystems: "internal_systems",
  GeneralAssistant: "general_assistant",
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

/**
 * Groups the settings cards into labelled bands. The edit form is a long scroll
 * of eleven cards; without headings it reads as an undifferentiated pile.
 */
function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="pt-4 first:pt-0">
      <h2 className="type-label text-foreground">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      <div className="mt-2 border-b border-border" />
    </div>
  );
}

export default function AgentDetailPage() {
  const t = useTranslations();
  const format = useFormatter();
  const params = useParams();
  const router = useRouter();
  const { activeCompanyId, user } = useAuth();
  const [refreshingToken, setRefreshingToken] = useState(false);
  const agentId = Number(params.id);
  const searchParams = useSearchParams();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
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
        whatsAppMode: (a.whatsAppMode as "Agent" | "Inbox") ?? "Agent",
        supportWhatsAppNumber: a.supportWhatsAppNumber ?? "",
        salesWhatsAppNumber: a.salesWhatsAppNumber ?? "",
        supportEmail: a.supportEmail ?? "",
        salesEmail: a.salesEmail ?? "",
        welcomeMessage: a.welcomeMessage ?? "",
        widgetPrimaryColor: a.widgetPrimaryColor ?? "",
        widgetTitle: a.widgetTitle ?? "",
        widgetPlaceholder: a.widgetPlaceholder ?? "",
        widgetPosition: (a.widgetPosition as "left" | "right" | "") ?? "",
        responseStyle: (a.responseStyle as "Professional" | "Friendly" | "Concise" | "") ?? "",
        leadCaptureEnabled: a.leadCaptureEnabled ?? false,
        leadCapturePrompt: a.leadCapturePrompt ?? "",
        handoffEnabled: a.handoffEnabled ?? false,
        handoffNotifyEmail: a.handoffNotifyEmail ?? "",
        handoffNotifyWhatsApp: a.handoffNotifyWhatsApp ?? "",
        handoffMessage: a.handoffMessage ?? "",
      });
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadAgent(); }, [activeCompanyId, agentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-poll file status when any file is still processing
  useEffect(() => {
    const hasProcessing = files.some((f) => f.processingStatus === "Pending" || f.processingStatus === "Processing");
    if (!hasProcessing) return;
    const interval = setInterval(async () => {
      try {
        const updated = await filesApi.list(agentId);
        setFiles(updated);
        const stillProcessing = updated.some((f) => f.processingStatus === "Pending" || f.processingStatus === "Processing");
        if (!stillProcessing) {
          clearInterval(interval);
          toast({ title: t("files.processingComplete") });
        }
      } catch { /* ignore polling errors */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [files.map((f) => `${f.id}:${f.processingStatus}`).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Google Calendar OAuth redirect result
  useEffect(() => {
    if (searchParams.get("calendar_connected") === "1") {
      toast({ title: t("agents.calendar.connectedSuccess") });
      // Reload agent to get updated calendarConnected + calendarGoogleEmail
      loadAgent();
      // Clean URL without triggering navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("calendar_connected");
      window.history.replaceState({}, "", url.toString());
    }
    const calError = searchParams.get("calendar_error");
    if (calError) {
      toast({ variant: "destructive", title: t("agents.calendar.connectError"), description: calError });
      const url = new URL(window.location.href);
      url.searchParams.delete("calendar_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCalendarConnect() {
    try {
      const { authUrl } = await calendarApi.getAuthUrl(agentId);
      window.location.href = authUrl;
    } catch {
      toast({ variant: "destructive", title: t("agents.calendar.connectError") });
    }
  }

  async function handleCalendarDisconnect() {
    try {
      await calendarApi.disconnect(agentId);
      setAgent((prev) => prev ? { ...prev, calendarConnected: false, calendarGoogleEmail: null } : prev);
      toast({ title: t("agents.calendar.disconnectedSuccess") });
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    }
  }

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
      await agentsApi.update(activeCompanyId, agentId, payload);
      await loadAgent(); // refresh full detail — update returns only a partial result
      setTestKey((k) => k + 1); // reload test iframe
      toast({ title: t("common.success") });
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
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
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
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
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    e.target.value = "";
    if (file.size > 30 * 1024 * 1024) {
      toast({ variant: "destructive", title: t("files.sizeExceeded") });
      return;
    }
    setPendingFile(file);
  }

  async function confirmUpload() {
    if (!pendingFile) return;
    const file = pendingFile;
    setPendingFile(null);
    setUploadingFile(true);
    try {
      const uploaded = await filesApi.upload(agentId, file);
      setFiles((prev) => [uploaded, ...prev]);
      toast({ title: t("files.uploadSuccess") });
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleDeleteFile(fileId: number) {
    try {
      await filesApi.delete(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast({ title: t("common.success") });
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
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
    ? `${process.env.NEXT_PUBLIC_WIDGET_URL}/test.html?token=${agent.agentToken}&api=${encodeURIComponent(process.env.NEXT_PUBLIC_AI_API_URL || "")}&_t=${testKey}`
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
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/agents"><ArrowLeft className="mr-1 h-4 w-4" />{t("common.back")}</Link>
      </Button>
      <PageHeader
        eyebrow={t("agents.eyebrow")}
        title={agent.name}
        description={agent.description || undefined}
        action={
          <HeatStatus
            level={agent.isActive ? "live" : "idle"}
            label={agent.isActive ? t("agents.status.active") : t("agents.status.inactive")}
          />
        }
      />

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
            <SectionHeading
              title={t("agents.sections.setup")}
              description={t("agents.sections.setupHint")}
            />
            <Card className="plate">
              <CardHeader>
                <CardTitle className="type-display text-base">{t("agents.basicInfo")}</CardTitle>
                <CardDescription>{t("agents.basicInfoHint")}</CardDescription>
              </CardHeader>
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
                        <SelectItem value="general_assistant">{t("agents.industries.general_assistant")}</SelectItem>
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
                <div className="space-y-2">
                  <Label>{t("agents.responseStyle")}</Label>
                  <p className="text-xs text-muted-foreground">{t("agents.responseStyleHint")}</p>
                  <Select value={watch("responseStyle") || "default"} onValueChange={(v) => setValue("responseStyle", (v === "default" ? "" : v) as any)}>
                    <SelectTrigger><SelectValue placeholder={t("agents.responseStyleDefault")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t("agents.responseStyleDefault")}</SelectItem>
                      <SelectItem value="Professional">{t("agents.responseStyles.professional")}</SelectItem>
                      <SelectItem value="Friendly">{t("agents.responseStyles.friendly")}</SelectItem>
                      <SelectItem value="Concise">{t("agents.responseStyles.concise")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="plate">
              <CardHeader>
                <CardTitle className="type-display text-base">{t("agents.detail.prompts")}</CardTitle>
                <CardDescription>{t("agents.systemPromptHint")}</CardDescription>
              </CardHeader>
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

            <SectionHeading
              title={t("agents.sections.experience")}
              description={t("agents.sections.experienceHint")}
            />

            {/* Welcome Message */}
            <Card className="plate">
              <CardHeader>
                <CardTitle className="type-display text-base flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
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

            {/* Lead Capture */}
            <Card className="plate">
              <CardHeader>
                <CardTitle className="type-display text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  {t("agents.leadCapture.title")}
                </CardTitle>
                <CardDescription>{t("agents.leadCapture.hint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>{t("agents.leadCapture.enable")}</Label>
                  <Switch
                    checked={watch("leadCaptureEnabled")}
                    onCheckedChange={(v) => setValue("leadCaptureEnabled", v)}
                  />
                </div>
                {watch("leadCaptureEnabled") && (
                  <div className="space-y-2">
                    <Label>{t("agents.leadCapture.prompt")} <span className="text-muted-foreground">({t("common.optional")})</span></Label>
                    <textarea
                      className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder={t("agents.leadCapture.promptPlaceholder")}
                      {...register("leadCapturePrompt")}
                    />
                    <p className="text-xs text-muted-foreground">{t("agents.leadCapture.promptHint")}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Human Handoff */}
            <Card className="plate">
              <CardHeader>
                <CardTitle className="type-display text-base flex items-center gap-2">
                  <PhoneForwarded className="h-4 w-4 text-muted-foreground" />
                  {t("agents.handoff.title")}
                </CardTitle>
                <CardDescription>{t("agents.handoff.hint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>{t("agents.handoff.enable")}</Label>
                  <Switch
                    checked={watch("handoffEnabled")}
                    onCheckedChange={(v) => setValue("handoffEnabled", v)}
                  />
                </div>
                {watch("handoffEnabled") && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("agents.handoff.notifyEmail")} <span className="text-muted-foreground">({t("common.optional")})</span></Label>
                        <Input {...register("handoffNotifyEmail")} type="email" placeholder="support@company.com" aria-invalid={!!errors.handoffNotifyEmail} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("agents.handoff.notifyWhatsApp")} <span className="text-muted-foreground">({t("common.optional")})</span></Label>
                        <PhoneInput
                        value={watch("handoffNotifyWhatsApp")}
                        onChange={(v) => setValue("handoffNotifyWhatsApp", v)}
                        placeholder="11 90000-0000"
                      />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("agents.handoff.message")} <span className="text-muted-foreground">({t("common.optional")})</span></Label>
                      <textarea
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder={t("agents.handoff.messagePlaceholder")}
                        {...register("handoffMessage")}
                      />
                      <p className="text-xs text-muted-foreground">{t("agents.handoff.messageHint")}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Conversation Starters */}
            <Card className="plate">
              <CardHeader>
                <CardTitle className="type-display text-base">{t("agents.starters.title")}</CardTitle>
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
            <Card className="plate">
              <CardHeader>
                <CardTitle className="type-display text-base flex items-center gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
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

            <SectionHeading
              title={t("agents.sections.channels")}
              description={t("agents.sections.channelsHint")}
            />

            {subscription?.plan?.hasWhatsApp ? (
              <Card className="plate">
                <CardHeader>
                  <CardTitle className="type-display text-base">{t("agents.whatsapp.title")}</CardTitle>
                  <CardDescription>{t("agents.whatsapp.modeHint")}</CardDescription>
                </CardHeader>
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
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t("agents.whatsapp.modeLabel")}</Label>
                        <p className="text-xs text-muted-foreground">{t("agents.whatsapp.modeHint")}</p>
                        <Select
                          value={watch("whatsAppMode") ?? "Agent"}
                          onValueChange={(v) => setValue("whatsAppMode", v as "Agent" | "Inbox")}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Agent">{t("agents.whatsapp.modeAgent")}</SelectItem>
                            <SelectItem value="Inbox">{t("agents.whatsapp.modeInbox")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {/* The whole point: one button. Meta's popup collects the
                          number, and the server does the token exchange, webhook
                          subscription and number registration. The manual fields
                          below are an escape hatch, not the path. */}
                      {agent.whatsAppBillingIssue ? (
                        /* A different dead end from a dead token, with a
                           different fix — reconnecting here changes nothing. */
                        <div className="space-y-2 rounded-xl border border-spark/40 bg-spark/10 p-3">
                          <HeatStatus level="attention" label={t("agents.whatsapp.billingIssue")} />
                          <p className="text-xs text-spark-ink">
                            {t("agents.whatsapp.billingIssueHint")}
                          </p>
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href="https://business.facebook.com/billing_hub/payment_settings"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t("agents.whatsapp.openBilling")}
                            </a>
                          </Button>
                        </div>
                      ) : agent.whatsAppNeedsReconnect ? (
                        /* The whole point of tracking this: a dead connection
                           says so instead of looking like a quiet day. */
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-spark/40 bg-spark/10 p-3">
                          <div className="min-w-0">
                            <HeatStatus level="attention" label={t("agents.whatsapp.needsReconnect")} />
                            <p className="mt-1 text-xs text-spark-ink">
                              {t("agents.whatsapp.needsReconnectHint")}
                            </p>
                          </div>
                          {activeCompanyId && (
                            <ConnectWhatsAppButton
                              companyId={activeCompanyId}
                              agentId={agentId}
                              onConnected={() => loadAgent()}
                            />
                          )}
                        </div>
                      ) : agent.hasWhatsAppToken ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-3">
                          <div className="min-w-0">
                            <HeatStatus level="live" label={t("agents.whatsapp.connected")} />
                            <p className="type-readout mt-1 text-xs text-muted-foreground">
                              {agent.whatsAppPhoneNumberId}
                            </p>
                            {/* The single most common reason a fresh connection
                                delivers nothing, and Meta gives no warning. */}
                            <p className="mt-2 max-w-md text-xs text-muted-foreground">
                              {t("agents.whatsapp.paymentReminder")}
                            </p>
                          </div>
                          {activeCompanyId && (
                            <ConnectWhatsAppButton
                              companyId={activeCompanyId}
                              agentId={agentId}
                              onConnected={() => loadAgent()}
                            />
                          )}
                        </div>
                      ) : (
                        activeCompanyId && (
                          <div className="space-y-2 rounded-xl border bg-muted/40 p-4">
                            <p className="text-sm font-medium">{t("agents.whatsapp.connectTitle")}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("agents.whatsapp.connectDescription")}
                            </p>
                            <ConnectWhatsAppButton
                              companyId={activeCompanyId}
                              agentId={agentId}
                              onConnected={() => loadAgent()}
                            />
                          </div>
                        )
                      )}

                      {/* Proves the refresh path in seconds rather than 45
                          days. Super admin only — customers never see it. */}
                      {user?.isSuperAdmin && agent.hasWhatsAppToken && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-3">
                          <div className="min-w-0">
                            <p className="type-label text-muted-foreground">
                              {t("agents.whatsapp.adminTools")}
                            </p>
                            <p className="type-readout mt-1 text-xs text-muted-foreground">
                              {agent.whatsAppTokenExpiresAt
                                ? t("agents.whatsapp.tokenExpires", {
                                    date: format.dateTime(new Date(agent.whatsAppTokenExpiresAt), {
                                      dateStyle: "short",
                                      timeStyle: "short",
                                    }),
                                  })
                                : t("agents.whatsapp.tokenPermanent")}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={refreshingToken}
                            onClick={async () => {
                              setRefreshingToken(true);
                              try {
                                const { refreshed } = await whatsAppOnboardingApi.refresh(agentId);
                                toast({
                                  variant: refreshed ? undefined : "destructive",
                                  title: refreshed
                                    ? t("agents.whatsapp.refreshSuccess")
                                    : t("agents.whatsapp.refreshFailed"),
                                });
                                await loadAgent();
                              } catch (err) {
                                toast({
                                  variant: "destructive",
                                  title: apiErrorMessage(err, t("errors.generic")),
                                });
                              } finally {
                                setRefreshingToken(false);
                              }
                            }}
                          >
                            {refreshingToken && <LoadingSpinner size="sm" className="mr-2" />}
                            {t("agents.whatsapp.refreshToken")}
                          </Button>
                        </div>
                      )}

                      {/* Manual setup, collapsed. Only needed when Embedded
                          Signup is unavailable, or for a number that is already
                          on someone else's Business Manager. */}
                      <details className="rounded-xl border p-3">
                        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                          {t("agents.whatsapp.manualSetup")}
                        </summary>
                        <div className="mt-4 space-y-4">
                          <div className="space-y-2">
                            <Label>{t("agents.whatsapp.phoneNumberId")}</Label>
                            <p className="text-xs text-muted-foreground">{t("agents.whatsapp.phoneNumberHint")}</p>
                            <Input
                              {...register("whatsAppPhoneNumberId")}
                              placeholder="123456789012345"
                              inputMode="numeric"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              {t("agents.whatsapp.accessToken")}
                              <Badge variant={agent.hasWhatsAppToken ? "success" : "outline"}>
                                {agent.hasWhatsAppToken ? t("agents.whatsapp.tokenSet") : t("agents.whatsapp.tokenNotSet")}
                              </Badge>
                            </Label>
                            <p className="text-xs text-muted-foreground">{t("agents.whatsapp.accessTokenHint")}</p>
                            <Input
                              {...register("whatsAppAccessToken")}
                              type="password"
                              autoComplete="off"
                              placeholder={agent.hasWhatsAppToken ? "••••••••••••••••" : "EAAG..."}
                            />
                          </div>
                        </div>
                      </details>
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
              <Card className="plate">
                <CardHeader>
                  <CardTitle className="type-display text-base">{t("agents.escalation.title")}</CardTitle>
                  <p className="text-xs text-muted-foreground">{t("agents.escalation.hint")}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("agents.escalation.supportWhatsApp")}</Label>
                      <PhoneInput
                        value={watch("supportWhatsAppNumber")}
                        onChange={(v) => setValue("supportWhatsAppNumber", v)}
                        placeholder="11 90000-0000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("agents.escalation.salesWhatsApp")}</Label>
                      <PhoneInput
                        value={watch("salesWhatsAppNumber")}
                        onChange={(v) => setValue("salesWhatsAppNumber", v)}
                        placeholder="11 90000-0000"
                      />
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

            {/* ── Google Calendar ─────────────────────────────────────── */}
            {subscription?.plan?.hasGoogleCalendar ? (
              <Card className="plate">
                <CardHeader>
                  <CardTitle className="type-display text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t("agents.calendar.title")}
                  </CardTitle>
                  <CardDescription>{t("agents.calendar.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {agent.calendarConnected ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-quench" />
                        {t("agents.calendar.connectedAs", { email: agent.calendarGoogleEmail ?? "" })}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                            {t("agents.calendar.disconnect")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("agents.calendar.disconnectTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>{t("agents.calendar.disconnectDescription")}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={handleCalendarDisconnect}>
                              {t("agents.calendar.disconnect")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ) : (
                    <Button onClick={handleCalendarConnect} className="gap-2" type="button">
                      <Calendar className="h-4 w-4" />
                      {t("agents.calendar.connect")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-sm font-medium">{t("agents.calendar.title")}</p>
                    <p className="text-xs text-muted-foreground">{t("agents.calendar.requiresPlan")}</p>
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
                      onChange={handleFileSelect}
                    />
                  </>
                )}
              </label>
            </CardContent>
          </Card>

          <AlertDialog open={!!pendingFile} onOpenChange={(open) => { if (!open) setPendingFile(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("files.confirmUploadTitle")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingFile && t("files.confirmUploadDescription", {
                    fileName: pendingFile.name,
                    fileSize: (pendingFile.size / 1024 / 1024).toFixed(2),
                  })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={confirmUpload}>{t("files.upload")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {files.length === 0 ? (
            <EmptyState
              eyebrow={t("emptyStates.eyebrowNothingYet")}
              title={t("files.empty")}
              description={t("files.emptyHint")}
            />
          ) : (
            <div className="plate divide-y overflow-hidden rounded-xl border bg-card">
              {files.map((file) => (
                <div key={file.id}>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{file.fileName}</p>
                        <p className="type-readout text-xs text-muted-foreground">
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Embed ─────────────────────────────────────────────────────── */}
        <TabsContent value="embed" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="type-display text-base">{t("agents.embedCode")}</CardTitle>
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
            <CardHeader><CardTitle className="type-display text-base">{t("agents.detail.agentToken")}</CardTitle></CardHeader>
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
              <CardTitle className="type-display text-base">{t("agents.detail.testTitle")}</CardTitle>
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
