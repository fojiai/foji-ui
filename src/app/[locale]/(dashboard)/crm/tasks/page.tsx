"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import {
  tasksApi, contactsApi, membersApi, subscriptionsApi,
  type CrmTask, type Contact, type CompanyMember, type CrmTaskInput,
  apiErrorMessage,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { HeatStatus } from "@/components/shared/heat";
import { toast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Check, RotateCcw,
  Phone, Users, Presentation, MapPin, CornerUpRight, Mail, MessageCircle, CircleDot, CalendarPlus,
} from "lucide-react";
import { TASK_TYPES, googleCalendarUrl } from "@/lib/task-types";

const TYPES = TASK_TYPES;

/** Icon per task type — a coloured badge alone is hard to scan in a long list. */
const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Call: Phone,
  Meeting: Users,
  Presentation: Presentation,
  Visit: MapPin,
  FollowUp: CornerUpRight,
  Email: Mail,
  WhatsApp: MessageCircle,
  General: CircleDot,
};
const PRIORITIES = ["Low", "Normal", "High"];
const emptyForm: CrmTaskInput = { title: "", type: "General", priority: "Normal" };

type BucketKey = "overdue" | "today" | "week" | "later" | "done";
const BUCKET_ORDER: BucketKey[] = ["overdue", "today", "week", "later", "done"];

/** Start of day, so "today" doesn't depend on the current time. */
function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function bucketFor(task: CrmTask, now: Date): BucketKey {
  if (task.status === "Done") return "done";
  if (!task.dueAt) return "later";

  const due = startOfDay(new Date(task.dueAt));
  const today = startOfDay(now);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 7) return "week";
  return "later";
}

export default function TasksPage() {
  const t = useTranslations();
  const format = useFormatter();
  const { activeCompanyId } = useAuth();
  const locale = (useParams().locale as string) ?? "pt-br";

  const [hasCrm, setHasCrm] = useState<boolean | null>(null);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CrmTaskInput>(emptyForm);

  const fetchTasks = useCallback(
    async (next?: { status?: string; assignee?: string }) => {
      if (!activeCompanyId) return;
      const status = next?.status ?? statusFilter;
      const assignee = next?.assignee ?? assigneeFilter;
      const params: { status?: string; assigneeUserId?: number } = {};
      if (status !== "all") params.status = status;
      if (assignee !== "all") params.assigneeUserId = Number(assignee);
      setIsFetching(true);
      try {
        setTasks(await tasksApi.list(activeCompanyId, params));
      } catch (err) {
        toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
      } finally {
        setIsFetching(false);
      }
    },
    [activeCompanyId, statusFilter, assigneeFilter, t]
  );

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    (async () => {
      try {
        const sub = await subscriptionsApi.getSubscription(activeCompanyId).catch(() => null);
        const enabled = sub?.plan?.hasCrm ?? false;
        if (cancelled) return;
        setHasCrm(enabled);
        if (enabled) {
          const [taskList, contactList, memberList] = await Promise.all([
            tasksApi.list(activeCompanyId, {}),
            contactsApi.list(activeCompanyId).catch(() => []),
            membersApi.list(activeCompanyId).catch(() => []),
          ]);
          if (cancelled) return;
          setTasks(taskList);
          setContacts(contactList);
          setMembers(memberList);
        }
      } catch {
        if (!cancelled) toast({ variant: "destructive", title: t("errors.generic") });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Group by urgency — a flat list gives no sense of what needs doing now. */
  const buckets = useMemo(() => {
    const now = new Date();
    const map: Record<BucketKey, CrmTask[]> = { overdue: [], today: [], week: [], later: [], done: [] };
    for (const task of tasks) map[bucketFor(task, now)].push(task);

    const byDue = (a: CrmTask, b: CrmTask) => {
      if (!a.dueAt && !b.dueAt) return 0;
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    };
    BUCKET_ORDER.forEach((k) => map[k].sort(byDue));
    return map;
  }, [tasks]);

  const openCount = tasks.filter((x) => x.status !== "Done").length;

  async function createTask() {
    if (!activeCompanyId || !form.title.trim()) return;
    setSaving(true);
    try {
      await tasksApi.create(activeCompanyId, form);
      setDialogOpen(false);
      setForm(emptyForm);
      await fetchTasks();
      toast({ title: t("crm.tasks.created") });
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setSaving(false);
    }
  }

  /** Optimistic — the checkbox should feel instant; revert if the call fails. */
  async function toggleStatus(task: CrmTask) {
    if (!activeCompanyId) return;
    const next = task.status === "Done" ? "Open" : "Done";
    const previous = tasks;
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, status: next } : x)));
    try {
      const updated = await tasksApi.setStatus(activeCompanyId, task.id, next);
      setTasks((prev) => prev.map((x) => (x.id === task.id ? updated : x)));
      if (next === "Done") toast({ title: t("crm.tasks.completed") });
    } catch {
      setTasks(previous);
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  async function deleteTask(id: number) {
    if (!activeCompanyId) return;
    const previous = tasks;
    setTasks((prev) => prev.filter((x) => x.id !== id));
    try {
      await tasksApi.delete(activeCompanyId, id);
    } catch {
      setTasks(previous);
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  if (isLoading) return <PageLoader />;

  if (!hasCrm) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("crm.eyebrow")}
          title={t("crm.tasks.title")}
          description={t("crm.tasks.description")}
        />
        <EmptyState
          tone="warn"
          eyebrow={t("emptyStates.eyebrowBilling")}
          title={t("crm.locked.title")}
          description={t("crm.locked.description")}
          action={
            <Button asChild>
              <Link href={`/${locale}/billing`}>{t("crm.locked.upgrade")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  function TaskRow({ task, overdue }: { task: CrmTask; overdue: boolean }) {
    const done = task.status === "Done";
    return (
      /* No per-row tint for overdue: the bucket heading above already says
         "atrasadas" and the due date below runs hot. Three devices for one
         fact is the redundant encoding the design rules call out. */
      /* The row used to fade to 60% when done. Measured, that puts the already-
         muted metadata at 2.45:1 in light mode — no opacity below 1.0 keeps it
         at AA. The done state is carried by the struck-through, muted title,
         the reopen button and the "concluídas" bucket, which is plenty. */
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            className="mt-0.5 h-7 w-7 shrink-0"
            onClick={() => toggleStatus(task)}
            aria-label={done ? t("crm.tasks.reopen") : t("crm.tasks.markDone")}
          >
            {done ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <div className="min-w-0 space-y-1">
            <p className={`text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}>
              {task.title}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <Badge variant="outline" className="gap-1 text-[10px]">
                {(() => {
                  const Icon = TYPE_ICONS[task.type] ?? CircleDot;
                  return <Icon className="h-3 w-3" />;
                })()}
                {t(`crm.tasks.types.${task.type}`)}
              </Badge>
              {task.contactName && (
                <Link
                  href={`/${locale}/crm/contacts/${task.contactId}`}
                  className="truncate hover:underline"
                >
                  {task.contactName}
                </Link>
              )}
              {task.dealTitle && (
                <Link
                  href={`/${locale}/crm/deals/${task.dealId}`}
                  className="truncate hover:underline"
                >
                  {task.dealTitle}
                </Link>
              )}
              {task.assigneeName && <span>· {task.assigneeName}</span>}
              {task.dueAt && (
                <span className={`type-readout ${overdue ? "font-semibold text-spark-ink" : ""}`}>
                  · {format.dateTime(new Date(task.dueAt), { dateStyle: "short" })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Only High burns. Normal and Low are iron — if every priority were
              tinted, none of them would mean anything. */}
          <Badge variant={task.priority === "High" ? "attention" : task.priority === "Low" ? "secondary" : "outline"}>
            {t(`crm.tasks.priorities.${task.priority}`)}
          </Badge>
          {task.dueAt && !done && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              title={t("crm.tasks.addToCalendar")}
              asChild
            >
              <a
                href={googleCalendarUrl({
                  title: task.title,
                  dueAt: task.dueAt,
                  details: task.description,
                })}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("crm.tasks.addToCalendar")}
              >
                <CalendarPlus className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{task.title}</AlertDialogTitle>
                <AlertDialogDescription>{t("crm.tasks.deleteConfirm")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("crm.tasks.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteTask(task.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t("crm.tasks.delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("crm.eyebrow")}
        title={t("crm.tasks.title")}
        description={t("crm.tasks.description")}
        action={
          <>
            {buckets.overdue.length > 0 && (
              <HeatStatus
                level="attention"
                label={t("crm.tasks.overdueCount", { count: buckets.overdue.length })}
              />
            )}
            <span className="type-readout text-sm text-muted-foreground">
              {t("crm.tasks.openCount", { count: openCount })}
            </span>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> {t("crm.tasks.new")}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); fetchTasks({ status: v }); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("crm.tasks.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("crm.tasks.allStatuses")}</SelectItem>
            <SelectItem value="Open">{t("crm.tasks.statuses.Open")}</SelectItem>
            <SelectItem value="Done">{t("crm.tasks.statuses.Done")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={(v) => { setAssigneeFilter(v); fetchTasks({ assignee: v }); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("crm.tasks.filterByAssignee")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("crm.tasks.allAssignees")}</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={String(m.userId)}>{m.firstName} {m.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isFetching ? (
        <SkeletonRows rows={5} />
      ) : tasks.length === 0 ? (
        <EmptyState
          eyebrow={t("emptyStates.eyebrowNothingYet")}
          title={t("crm.tasks.empty")}
          description={t("crm.tasks.emptyHint")}
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> {t("crm.tasks.new")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {BUCKET_ORDER.map((key) => {
            const items = buckets[key];
            if (items.length === 0) return null;
            return (
              <section key={key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2
                    className={`type-label ${
                      key === "overdue" ? "text-spark-ink" : "text-muted-foreground"
                    }`}
                  >
                    {t(`crm.tasks.buckets.${key}`)}
                  </h2>
                  <span className="type-readout rounded bg-muted px-1.5 text-xs text-muted-foreground">
                    {items.length}
                  </span>
                </div>
                <div className="plate divide-y overflow-hidden rounded-xl border bg-card">
                  {items.map((task) => (
                    <TaskRow key={task.id} task={task} overdue={key === "overdue"} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("crm.tasks.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("crm.tasks.title_field")}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("crm.tasks.type")}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((x) => {
                      const Icon = TYPE_ICONS[x] ?? CircleDot;
                      return (
                        <SelectItem key={x} value={x}>
                          <span className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {t(`crm.tasks.types.${x}`)}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("crm.tasks.priority")}</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((x) => <SelectItem key={x} value={x}>{t(`crm.tasks.priorities.${x}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("crm.tasks.contact")}</Label>
                <Select
                  value={form.contactId ? String(form.contactId) : "none"}
                  onValueChange={(v) => setForm({ ...form, contactId: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("crm.tasks.noContact")}</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name || c.email || c.phone || `#${c.id}`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("crm.tasks.assignee")}</Label>
                <Select
                  value={form.assigneeUserId ? String(form.assigneeUserId) : "none"}
                  onValueChange={(v) => setForm({ ...form, assigneeUserId: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("crm.tasks.allAssignees")}</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.userId} value={String(m.userId)}>{m.firstName} {m.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("crm.tasks.dueAt")}</Label>
              <DatePicker
                value={form.dueAt ?? ""}
                onChange={(v) => setForm({ ...form, dueAt: v || null })}
                placeholder={t("crm.tasks.noDueDate")}
                clearLabel={t("common.clear")}
                todayLabel={t("common.today")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("crm.tasks.description_field")}</Label>
              <Textarea
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("crm.tasks.cancel")}</Button>
            <Button onClick={createTask} disabled={saving || !form.title.trim()}>
              {saving && <LoadingSpinner size="sm" className="mr-2" />}
              {t("crm.tasks.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
