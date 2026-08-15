"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import {
  dealsApi, pipelineApi, membersApi, tasksApi,
  type Deal, type Pipeline, type CompanyMember, type CrmTask,
  apiErrorMessage,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Trash2, User, Contact2, CalendarDays, CircleDollarSign, CheckCircle2, Circle,
} from "lucide-react";

export default function DealDetailPage() {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? "pt-br";
  const dealId = Number(params.id);
  const { activeCompanyId } = useAuth();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [movingStage, setMovingStage] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("0");
  const [ownerUserId, setOwnerUserId] = useState<string>("none");
  const [expectedClose, setExpectedClose] = useState("");

  function hydrate(d: Deal) {
    setDeal(d);
    setTitle(d.title);
    setValue(String(d.value ?? 0));
    setOwnerUserId(d.ownerUserId ? String(d.ownerUserId) : "none");
    setExpectedClose(d.expectedCloseDate ? d.expectedCloseDate.slice(0, 10) : "");
  }

  useEffect(() => {
    if (!activeCompanyId || !Number.isFinite(dealId)) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await dealsApi.get(activeCompanyId, dealId);
        if (cancelled) return;
        hydrate(d);
        const [pipes, memberList, taskList] = await Promise.all([
          pipelineApi.list(activeCompanyId).catch(() => [] as Pipeline[]),
          membersApi.list(activeCompanyId).catch(() => []),
          tasksApi.list(activeCompanyId, { dealId }).catch(() => [] as CrmTask[]),
        ]);
        if (cancelled) return;
        setPipeline(pipes.find((p) => p.id === d.pipelineId) ?? pipes[0] ?? null);
        setMembers(memberList);
        setTasks(taskList);
      } catch {
        if (!cancelled) toast({ variant: "destructive", title: t("errors.generic") });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeCompanyId, dealId]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusVariant = useMemo(() => {
    switch (deal?.status) {
      case "Won": return "success";
      case "Lost": return "destructive";
      default: return "outline";
    }
  }, [deal?.status]);

  async function save() {
    if (!activeCompanyId || !deal) return;
    const parsed = Number(value);
    if (!title.trim()) {
      toast({ variant: "destructive", title: t("crm.deals.titleRequired") });
      return;
    }
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({ variant: "destructive", title: t("crm.deals.valueInvalid") });
      return;
    }
    setSaving(true);
    try {
      const updated = await dealsApi.update(activeCompanyId, deal.id, {
        title: title.trim(),
        value: parsed,
        currency: deal.currency,
        ownerUserId: ownerUserId === "none" ? null : Number(ownerUserId),
        expectedCloseDate: expectedClose ? new Date(expectedClose).toISOString() : null,
      });
      hydrate(updated);
      toast({ title: t("crm.deals.saved") });
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setSaving(false);
    }
  }

  async function moveStage(stageId: string) {
    if (!activeCompanyId || !deal) return;
    setMovingStage(true);
    try {
      hydrate(await dealsApi.move(activeCompanyId, deal.id, Number(stageId)));
      toast({ title: t("crm.pipeline.moved") });
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setMovingStage(false);
    }
  }

  async function remove() {
    if (!activeCompanyId || !deal) return;
    try {
      await dealsApi.delete(activeCompanyId, deal.id);
      toast({ title: t("crm.deals.deleted") });
      router.push(`/${locale}/crm/pipeline`);
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    }
  }

  if (isLoading) return <PageLoader />;
  if (!deal) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/${locale}/crm/pipeline`} aria-label={t("crm.deals.back")}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-balance">{deal.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant as never}>{t(`crm.dealStatuses.${deal.status}`)}</Badge>
              <span className="text-sm text-muted-foreground">{deal.stageName}</span>
            </div>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive hover:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> {t("crm.deals.delete")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("crm.deals.deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("crm.deals.deleteDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("crm.pipeline.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={remove}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("crm.deals.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <CircleDollarSign className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("crm.pipeline.value")}</p>
              <p className="truncate font-semibold tabular-nums">
                {format.number(deal.value ?? 0, { style: "currency", currency: deal.currency || "BRL" })}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Contact2 className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("crm.pipeline.contact")}</p>
              {deal.contactId ? (
                <Link
                  href={`/${locale}/crm/contacts/${deal.contactId}`}
                  className="truncate font-medium hover:underline block"
                >
                  {deal.contactName || t("crm.contacts.anonymous")}
                </Link>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("crm.pipeline.expectedClose")}</p>
              <p className="truncate font-medium">
                {deal.expectedCloseDate
                  ? format.dateTime(new Date(deal.expectedCloseDate), { dateStyle: "medium" })
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("crm.deals.stage")}</CardTitle>
          <CardDescription>{t("crm.deals.stageHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select
              value={String(deal.stageId)}
              onValueChange={moveStage}
              disabled={movingStage || !pipeline}
            >
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(pipeline?.stages ?? []).map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {movingStage && <LoadingSpinner size="sm" />}
          </div>
        </CardContent>
      </Card>

      {/* Details form */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t("crm.deals.details")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("crm.pipeline.dealTitle")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("crm.pipeline.value")} ({deal.currency})</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("crm.pipeline.expectedClose")}</Label>
              <DatePicker
                value={expectedClose}
                onChange={setExpectedClose}
                clearLabel={t("common.clear")}
                todayLabel={t("common.today")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("crm.pipeline.owner")}</Label>
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("crm.contacts.noOwner")}</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={String(m.userId)}>{m.firstName} {m.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving && <LoadingSpinner size="sm" className="mr-2" />}
              {t("crm.contacts.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks linked to this deal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("crm.deals.tasks")}</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("crm.deals.tasksEmpty")}</p>
          ) : (
            <ul className="divide-y">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    {task.status === "Done" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={`truncate text-sm ${task.status === "Done" ? "text-muted-foreground line-through" : ""}`}>
                      {task.title}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    {task.assigneeName && (
                      <span className="hidden items-center gap-1 sm:flex">
                        <User className="h-3 w-3" /> {task.assigneeName}
                      </span>
                    )}
                    {task.dueAt && (
                      <span>{format.dateTime(new Date(task.dueAt), { dateStyle: "short" })}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
