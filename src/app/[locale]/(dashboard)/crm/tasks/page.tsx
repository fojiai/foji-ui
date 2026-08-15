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
import { Card, CardContent } from "@/components/ui/card";
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
import { toast } from "@/hooks/use-toast";
import {
  ListChecks, Plus, Lock, Trash2, Check, RotateCcw, AlertTriangle,
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("crm.tasks.title")}</h1>
          <p className="text-muted-foreground">{t("crm.tasks.description")}</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Lock className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">{t("crm.locked.title")}</p>
            <p className="max-w-md text-xs text-muted-foreground">{t("crm.locked.description")}</p>
            <Button asChild className="mt-2">
              <Link href={`/${locale}/billing`}>{t("crm.locked.upgrade")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  function TaskRow({ task, overdue }: { task: CrmTask; overdue: boolean }) {
    const done = task.status === "Done";
    return (
      <div
        className={`flex items-start justify-between gap-3 rounded-lg border bg-card p-3 transition-colors ${
          done ? "opacity-60" : ""
        } ${overdue ? "border-destructive/40" : ""}`}
      >
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
            <p className={`text-sm font-medium ${done ? "line-through" : ""}`}>{task.title}</p>
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
                <span className={overdue ? "font-medium text-destructive" : ""}>
                  · {format.dateTime(new Date(task.dueAt), { dateStyle: "short" })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant={task.priority === "High" ? "destructive" : task.priority === "Low" ? "secondary" : "outline"}
            className="text-[10px]"
          >
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("crm.tasks.title")}</h1>
          <p className="text-muted-foreground">{t("crm.tasks.description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {buckets.overdue.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t("crm.tasks.overdueCount", { count: buckets.overdue.length })}
            </Badge>
          )}
          <Badge variant="outline" className="tabular-nums">
            {t("crm.tasks.openCount", { count: openCount })}
          </Badge>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t("crm.tasks.new")}
          </Button>
        </div>
      </div>

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
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">{t("crm.tasks.empty")}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{t("crm.tasks.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {BUCKET_ORDER.map((key) => {
            const items = buckets[key];
            if (items.length === 0) return null;
            return (
              <section key={key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2
                    className={`text-sm font-semibold uppercase tracking-wide ${
                      key === "overdue" ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {t(`crm.tasks.buckets.${key}`)}
                  </h2>
                  <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
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
