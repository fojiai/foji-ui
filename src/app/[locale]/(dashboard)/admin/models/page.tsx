"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { modelsApi, type AIModel } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  provider: z.enum(["OpenAi", "Gemini", "Bedrock"]),
  modelId: z.string().min(1),
  inputCostPer1M: z.coerce.number().min(0),
  outputCostPer1M: z.coerce.number().min(0),
  isActive: z.boolean(),
  isDefault: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export default function ModelsPage() {
  const t = useTranslations();
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AIModel | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isActive: true, isDefault: false, provider: "OpenAi", inputCostPer1M: 0, outputCostPer1M: 0 },
  });

  async function load() {
    setIsLoading(true);
    try { setModels(await modelsApi.list()); } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setEditing(null);
    reset({ isActive: true, isDefault: false, provider: "OpenAi", inputCostPer1M: 0, outputCostPer1M: 0 });
    setDialogOpen(true);
  }

  function openEdit(model: AIModel) {
    setEditing(model);
    reset({ ...model });
    setDialogOpen(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      if (editing) {
        await modelsApi.update(editing.id, data);
        toast({ title: t("common.success") });
      } else {
        await modelsApi.create(data);
        toast({ title: t("common.success") });
      }
      setDialogOpen(false);
      await load();
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setSaving(false); }
  }

  async function deleteModel(id: number) {
    try {
      await modelsApi.delete(id);
      toast({ title: t("common.success") });
      setModels((prev) => prev.filter((m) => m.id !== id));
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
  }

  const PROVIDER_LABELS: Record<string, string> = {
    OpenAi: "OpenAI",
    Gemini: "Google Gemini",
    Bedrock: "AWS Bedrock",
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("admin.models.title")}</h2>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> {t("admin.models.create")}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {models.map((model) => (
          <Card key={model.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{model.displayName}</CardTitle>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{model.modelId}</p>
                </div>
                <div className="flex gap-1">
                  {model.isDefault && <Badge variant="secondary">Default</Badge>}
                  <Badge variant={model.isActive ? "success" : "outline"}>
                    {model.isActive ? t("common.active") : t("common.inactive")}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("admin.models.provider")}</span>
                <span className="font-medium">{PROVIDER_LABELS[model.provider] ?? model.provider}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Input / 1M</span>
                <span className="font-mono">${model.inputCostPer1M.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Output / 1M</span>
                <span className="font-mono">${model.outputCostPer1M.toFixed(3)}</span>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(model)}>
                  <Pencil className="mr-1 h-3 w-3" /> {t("common.edit")}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("common.confirm")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        Delete <strong>{model.displayName}</strong>?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteModel(model.id)}>
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("common.edit") : t("admin.models.create")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("admin.models.displayName")}</Label>
              <Input {...register("displayName")} aria-invalid={!!errors.displayName} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input {...register("name")} aria-invalid={!!errors.name} />
            </div>
            <div className="space-y-2">
              <Label>{t("admin.models.provider")}</Label>
              <Select
                value={watch("provider")}
                onValueChange={(v) => setValue("provider", v as any)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.models.modelId")}</Label>
              <Input {...register("modelId")} placeholder="e.g. gpt-5.4-nano" aria-invalid={!!errors.modelId} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("admin.models.inputCost")}</Label>
                <Input type="number" step="0.001" {...register("inputCostPer1M")} />
              </div>
              <div className="space-y-2">
                <Label>{t("admin.models.outputCost")}</Label>
                <Input type="number" step="0.001" {...register("outputCostPer1M")} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">{t("admin.models.isActive")}</Label>
              <Switch
                id="isActive"
                checked={watch("isActive")}
                onCheckedChange={(v) => setValue("isActive", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isDefault">{t("admin.models.isDefault")}</Label>
              <Switch
                id="isDefault"
                checked={watch("isDefault")}
                onCheckedChange={(v) => setValue("isDefault", v)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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
