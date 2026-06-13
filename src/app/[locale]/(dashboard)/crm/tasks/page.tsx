"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import {
  tasksApi, contactsApi, membersApi, subscriptionsApi,
  type CrmTask, type Contact, type CompanyMember, type CrmTaskInput,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";
import { ListChecks, Plus, Lock, Trash2, Check, RotateCcw } from "lucide-react";

const TYPES = ["General", "Call", "Email", "WhatsApp", "Meeting"];
const PRIORITIES = ["Low", "Normal", "High"];
const textareaClass =
  "flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const emptyForm: CrmTaskInput = { title: "", type: "General", priority: "Normal" };

export default function TasksPage() {
  const t = useTranslations();
  const { activeCompanyId } = useAuth();
  const locale = (useParams().locale as string) ?? "pt-br";

  const [hasCrm, setHasCrm] = useState<boolean | null>(null);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CrmTaskInput>(emptyForm);

  async function loadTasks(companyId: number, next?: { status?: string; assignee?: string }) {
    const status = next?.status ?? statusFilter;
    const assignee = next?.assignee ?? assigneeFilter;
    const params: { status?: string; assigneeUserId?: number } = {};
    if (status !== "all") params.status = status;
    if (assignee !== "all") params.assigneeUserId = Number(assignee);
    setTasks(await tasksApi.list(companyId, params));
  }

  useEffect(() => {
    if (!activeCompanyId) return;
    async function load() {
      try {
        const sub = await subscriptionsApi.getSubscription(activeCompanyId!).catch(() => null);
        const enabled = sub?.plan?.hasCrm ?? false;
        setHasCrm(enabled);
        if (enabled) {
          const [, contactList, memberList] = await Promise.all([
            loadTasks(activeCompanyId!),
            contactsApi.list(activeCompanyId!).catch(() => []),
            membersApi.list(activeCompanyId!).catch(() => []),
          ]);
          setContacts(contactList);
          setMembers(memberList);
        }
      } catch {
        toast({ variant: "destructive", title: t("errors.generic") });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [activeCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refilter(next: { status?: string; assignee?: string }) {
    if (!activeCompanyId) return;
    try { await loadTasks(activeCompanyId, next); }
    catch { toast({ variant: "destructive", title: t("errors.generic") }); }
  }

  async function createTask() {
    if (!activeCompanyId || !form.title.trim()) return;
    setSaving(true);
    try {
      await tasksApi.create(activeCompanyId, form);
      setDialogOpen(false);
      setForm(emptyForm);
      await loadTasks(activeCompanyId);
      toast({ title: t("crm.tasks.created") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(task: CrmTask) {
    if (!activeCompanyId) return;
    const next = task.status === "Done" ? "Open" : "Done";
    try {
      const updated = await tasksApi.setStatus(activeCompanyId, task.id, next);
      setTasks((prev) => prev.map((x) => (x.id === task.id ? updated : x)));
      if (next === "Done") toast({ title: t("crm.tasks.completed") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  async function deleteTask(id: number) {
    if (!activeCompanyId) return;
    try {
      await tasksApi.delete(activeCompanyId, id);
      setTasks((prev) => prev.filter((x) => x.id !== id));
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  function isOverdue(task: CrmTask) {
    return task.status === "Open" && task.dueAt != null && new Date(task.dueAt) < new Date();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("crm.tasks.title")}</h1>
          <p className="text-muted-foreground">{t("crm.tasks.description")}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> {t("crm.tasks.new")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); refilter({ status: v }); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("crm.tasks.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("crm.tasks.allStatuses")}</SelectItem>
            <SelectItem value="Open">{t("crm.tasks.statuses.Open")}</SelectItem>
            <SelectItem value="Done">{t("crm.tasks.statuses.Done")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={(v) => { setAssigneeFilter(v); refilter({ assignee: v }); }}>
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

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">{t("crm.tasks.empty")}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{t("crm.tasks.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Card key={task.id} className={task.status === "Done" ? "opacity-60" : ""}>
              <CardContent className="flex items-center justify-between gap-4 py-3">
                <div className="flex items-start gap-3">
                  <Button
                    variant="outline" size="icon" className="mt-0.5 h-7 w-7 shrink-0"
                    onClick={() => toggleStatus(task)}
                    title={task.status === "Done" ? t("crm.tasks.reopen") : t("crm.tasks.markDone")}
                  >
                    {task.status === "Done" ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>
                  <div className="space-y-1">
                    <p className={`text-sm font-medium ${task.status === "Done" ? "line-through" : ""}`}>{task.title}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{t(`crm.tasks.types.${task.type}`)}</Badge>
                      {task.contactName && (
                        <Link href={`/${locale}/crm/contacts/${task.contactId}`} className="hover:underline">{task.contactName}</Link>
                      )}
                      {task.assigneeName && <span>· {task.assigneeName}</span>}
                      {task.dueAt && (
                        <span className={isOverdue(task) ? "font-medium text-destructive" : ""}>
                          · {new Date(task.dueAt).toLocaleDateString()}{isOverdue(task) ? ` (${t("crm.tasks.overdue")})` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={task.priority === "High" ? "destructive" : task.priority === "Low" ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {t(`crm.tasks.priorities.${task.priority}`)}
                  </Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{task.title}</AlertDialogTitle>
                        <AlertDialogDescription>{t("crm.tasks.delete")}?</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("crm.tasks.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteTask(task.id)}>{t("crm.tasks.delete")}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("crm.tasks.type")}</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map((x) => <SelectItem key={x} value={x}>{t(`crm.tasks.types.${x}`)}</SelectItem>)}
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
            <div className="grid grid-cols-2 gap-3">
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
              <Input
                type="date"
                value={form.dueAt ?? ""}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("crm.tasks.description_field")}</Label>
              <textarea className={textareaClass} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
