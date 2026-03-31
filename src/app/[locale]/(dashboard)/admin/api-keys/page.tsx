"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Eye, EyeOff, KeyRound, Cloud, Sparkles, Bot, Mail } from "lucide-react";
import { adminApi, type PlatformSettingResult } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";

// Predefined credential templates for quick setup
const CREDENTIAL_TEMPLATES = [
  { key: "OPENAI_API_KEY", label: "OpenAI API Key", category: "openai", icon: Sparkles },
  { key: "GEMINI_API_KEY", label: "Gemini API Key", category: "gemini", icon: Bot },
  { key: "AWS_ACCESS_KEY_ID", label: "AWS Access Key ID", category: "bedrock", icon: Cloud },
  { key: "AWS_SECRET_ACCESS_KEY", label: "AWS Secret Access Key", category: "bedrock", icon: Cloud },
  { key: "AWS_BEDROCK_REGION", label: "AWS Bedrock Region", category: "bedrock", icon: Cloud },
  { key: "CONTACT_EMAIL", label: "Contact Form Email", category: "platform", icon: Mail },
];

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType }> = {
  openai: { label: "OpenAI", icon: Sparkles },
  gemini: { label: "Google Gemini", icon: Bot },
  bedrock: { label: "AWS Bedrock", icon: Cloud },
  platform: { label: "Platform", icon: Mail },
};

const upsertSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  label: z.string().min(1),
  category: z.string().min(1),
  isSecret: z.boolean(),
});
type UpsertForm = z.infer<typeof upsertSchema>;

export default function ApiKeysPage() {
  const t = useTranslations();
  const [settings, setSettings] = useState<PlatformSettingResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  const form = useForm<UpsertForm>({
    resolver: zodResolver(upsertSchema),
    defaultValues: { isSecret: true, category: "openai" },
  });

  async function load() {
    setIsLoading(true);
    try {
      setSettings(await adminApi.getSettings());
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: UpsertForm) {
    setSaving(true);
    try {
      await adminApi.upsertSetting(data);
      toast({ title: t("common.success") });
      form.reset({ isSecret: true, category: "openai", key: "", value: "", label: "" });
      setDialogOpen(false);
      await load();
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSetting(key: string) {
    try {
      await adminApi.deleteSetting(key);
      toast({ title: t("common.success") });
      setSettings((prev) => prev.filter((s) => s.key !== key));
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  function openTemplateDialog(template: (typeof CREDENTIAL_TEMPLATES)[number]) {
    form.reset({
      key: template.key,
      label: template.label,
      category: template.category,
      isSecret: template.key !== "AWS_BEDROCK_REGION",
      value: "",
    });
    setDialogOpen(true);
  }

  function openCustomDialog() {
    form.reset({ key: "", value: "", label: "", category: "openai", isSecret: true });
    setDialogOpen(true);
  }

  function openEditDialog(setting: PlatformSettingResult) {
    form.reset({
      key: setting.key,
      value: setting.value,
      label: setting.label,
      category: setting.category,
      isSecret: setting.isSecret,
    });
    setDialogOpen(true);
  }

  function toggleReveal(key: string) {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Group settings by category
  const grouped = settings.reduce<Record<string, PlatformSettingResult[]>>((acc, s) => {
    const cat = s.category || "other";
    (acc[cat] ??= []).push(s);
    return acc;
  }, {});

  // Find unconfigured templates
  const configuredKeys = new Set(settings.map((s) => s.key));
  const unconfigured = CREDENTIAL_TEMPLATES.filter((t) => !configuredKeys.has(t.key));

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t("admin.apiKeys.title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("admin.apiKeys.description")}</p>
        </div>
        <Button onClick={openCustomDialog}>
          <Plus className="mr-1 h-4 w-4" /> {t("admin.apiKeys.addCustom")}
        </Button>
      </div>

      {/* Unconfigured quick setup */}
      {unconfigured.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("admin.apiKeys.quickSetup")}</CardTitle>
            <CardDescription>{t("admin.apiKeys.quickSetupHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {unconfigured.map((tpl) => (
                <Button
                  key={tpl.key}
                  variant="outline"
                  size="sm"
                  onClick={() => openTemplateDialog(tpl)}
                  className="gap-2"
                >
                  <tpl.icon className="h-4 w-4" />
                  {tpl.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configured settings by category */}
      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <KeyRound className="mx-auto h-8 w-8 mb-3 opacity-50" />
            <p>{t("admin.apiKeys.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, items]) => {
          const meta = CATEGORY_META[category];
          const Icon = meta?.icon ?? KeyRound;
          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  {meta?.label ?? category}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((setting) => (
                  <div
                    key={setting.key}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{setting.label}</p>
                        <Badge variant="secondary" className="text-xs font-mono">
                          {setting.key}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono mt-1">
                        {setting.isSecret && !revealedKeys.has(setting.key)
                          ? "••••••••••••"
                          : setting.value}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      {setting.isSecret && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleReveal(setting.key)}
                        >
                          {revealedKeys.has(setting.key) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(setting)}
                      >
                        {t("common.edit")}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("common.confirm")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("admin.apiKeys.deleteConfirm", { key: setting.key })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteSetting(setting.key)}>
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Upsert dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {form.getValues("key")
                ? t("admin.apiKeys.editKey")
                : t("admin.apiKeys.addKey")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin.apiKeys.keyName")}</Label>
              <Input
                placeholder="OPENAI_API_KEY"
                {...form.register("key")}
                className="font-mono"
                readOnly={!!configuredKeys.has(form.watch("key"))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.apiKeys.label")}</Label>
              <Input
                placeholder="OpenAI API Key"
                {...form.register("label")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.apiKeys.value")}</Label>
              <Input
                type="password"
                placeholder="sk-..."
                {...form.register("value")}
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.apiKeys.provider")}</Label>
                <Select
                  value={form.watch("category")}
                  onValueChange={(v) => form.setValue("category", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="bedrock">AWS Bedrock</SelectItem>
                    <SelectItem value="platform">Platform</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-7">
                <input
                  type="checkbox"
                  id="isSecret"
                  className="h-4 w-4 rounded border-input"
                  {...form.register("isSecret")}
                />
                <Label htmlFor="isSecret">{t("admin.apiKeys.secret")}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <LoadingSpinner size="sm" /> : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
