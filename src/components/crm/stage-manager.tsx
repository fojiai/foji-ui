"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { pipelineApi, type Pipeline, type PipelineStage, apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";

/**
 * Create, rename, reorder and delete pipeline stages. The API for all of this
 * already existed and had no UI at all, leaving users stuck with the seeded
 * stages.
 */
export function StageManager({
  open,
  onOpenChange,
  companyId,
  pipeline,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  pipeline: Pipeline | null;
  onChanged: () => Promise<void> | void;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [newIsWon, setNewIsWon] = useState(false);
  const [newIsLost, setNewIsLost] = useState(false);

  const stages = [...(pipeline?.stages ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  async function run(fn: () => Promise<unknown>, successKey?: string) {
    setBusy(true);
    try {
      await fn();
      await onChanged();
      if (successKey) toast({ title: t(successKey) });
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setBusy(false);
    }
  }

  async function addStage() {
    if (!pipeline || !newName.trim()) return;
    await run(
      () => pipelineApi.addStage(companyId, pipeline.id, newName.trim(), newIsWon, newIsLost),
      "crm.stages.added"
    );
    setNewName("");
    setNewIsWon(false);
    setNewIsLost(false);
  }

  async function renameStage(stage: PipelineStage) {
    if (!editName.trim()) return;
    await run(
      () => pipelineApi.updateStage(companyId, stage.id, editName.trim(), stage.isWon, stage.isLost),
      "crm.stages.renamed"
    );
    setEditingId(null);
  }

  async function move(index: number, dir: -1 | 1) {
    if (!pipeline) return;
    const next = [...stages];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await run(() => pipelineApi.reorder(companyId, pipeline.id, next.map((s) => s.id)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("crm.stages.title")}</DialogTitle>
          <DialogDescription>{t("crm.stages.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {stages.map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-2 rounded-md border p-2">
              <div className="flex flex-col">
                <Button
                  variant="ghost" size="icon" className="h-5 w-6"
                  disabled={busy || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={t("crm.stages.moveUp")}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-5 w-6"
                  disabled={busy || i === stages.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={t("crm.stages.moveDown")}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>

              {editingId === stage.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && renameStage(stage)}
                    autoFocus
                    className="h-8 flex-1"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy} onClick={() => renameStage(stage)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm font-medium">{stage.name}</span>
                  {stage.isWon && <Badge variant="success">{t("crm.stages.won")}</Badge>}
                  {stage.isLost && <Badge variant="destructive">{t("crm.stages.lost")}</Badge>}
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => { setEditingId(stage.id); setEditName(stage.name); }}
                    aria-label={t("crm.stages.rename")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={t("crm.stages.remove")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("crm.stages.removeTitle", { name: stage.name })}</AlertDialogTitle>
                        <AlertDialogDescription>{t("crm.stages.removeDescription")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("crm.pipeline.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => run(() => pipelineApi.removeStage(companyId, stage.id), "crm.stages.removed")}
                        >
                          {t("crm.stages.remove")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new stage */}
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("crm.stages.addNew")}
          </Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("crm.stages.namePlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && addStage()}
          />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={newIsWon}
                onCheckedChange={(v) => { setNewIsWon(v); if (v) setNewIsLost(false); }}
              />
              {t("crm.stages.markWon")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={newIsLost}
                onCheckedChange={(v) => { setNewIsLost(v); if (v) setNewIsWon(false); }}
              />
              {t("crm.stages.markLost")}
            </label>
            <Button size="sm" className="ml-auto" disabled={busy || !newName.trim()} onClick={addStage}>
              {busy ? <LoadingSpinner size="sm" /> : <><Plus className="mr-1 h-3.5 w-3.5" /> {t("crm.stages.add")}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
