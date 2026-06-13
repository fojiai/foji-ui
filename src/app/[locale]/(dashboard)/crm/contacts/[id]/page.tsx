"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import {
  contactsApi,
  membersApi,
  crmEmailsApi,
  type Contact,
  type CompanyMember,
  type TimelineItem,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, AlertTriangle, X, Plus, Mail, Sparkles,
  UserPlus, PhoneForwarded, Briefcase, Trophy, XCircle, ArrowRightLeft, CalendarClock, CheckCircle2,
} from "lucide-react";

const STATUSES = ["New", "Open", "Qualified", "Customer", "Unqualified", "Archived"];
const textareaClass =
  "flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const schema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  status: z.string(),
  ownerUserId: z.string().optional(),
  source: z.string().optional(),
  estimatedValue: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const TIMELINE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  lead: UserPlus,
  handoff: PhoneForwarded,
  deal_created: Briefcase,
  deal_won: Trophy,
  deal_lost: XCircle,
  deal_stage: ArrowRightLeft,
  meeting: CalendarClock,
  email: Mail,
  task_done: CheckCircle2,
};

export default function ContactDetailPage() {
  const t = useTranslations();
  const { activeCompanyId } = useAuth();
  const params = useParams();
  const locale = (params.locale as string) ?? "pt-br";
  const contactId = Number(params.id);

  const [contact, setContact] = useState<Contact | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [emailOpen, setEmailOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", subject: "", body: "" });
  const [emailGoal, setEmailGoal] = useState("");
  const [drafting, setDrafting] = useState(false);

  const { register, handleSubmit, setValue, watch, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "New" },
  });

  useEffect(() => {
    if (!activeCompanyId) { setIsLoading(false); return; }
    async function load() {
      try {
        const [c, tl, memberList] = await Promise.all([
          contactsApi.get(activeCompanyId!, contactId),
          contactsApi.timeline(activeCompanyId!, contactId).catch(() => []),
          membersApi.list(activeCompanyId!).catch(() => []),
        ]);
        setContact(c);
        setTimeline(tl);
        setTags(c.tags);
        setMembers(memberList);
        reset({
          name: c.name ?? "",
          email: c.email ?? "",
          phone: c.phone ?? "",
          status: c.status,
          ownerUserId: c.ownerUserId ? String(c.ownerUserId) : "none",
          source: c.source ?? "",
          estimatedValue: c.estimatedValue != null ? String(c.estimatedValue) : "",
          notes: c.notes ?? "",
        });
      } catch {
        toast({ variant: "destructive", title: t("errors.generic") });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [activeCompanyId, contactId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: FormData) {
    if (!activeCompanyId) return;
    setSaving(true);
    try {
      const updated = await contactsApi.update(activeCompanyId, contactId, {
        name: data.name || null,
        email: data.email || null,
        phone: data.phone || null,
        status: data.status,
        ownerUserId: data.ownerUserId && data.ownerUserId !== "none" ? Number(data.ownerUserId) : null,
        source: data.source || null,
        estimatedValue: data.estimatedValue ? Number(data.estimatedValue) : null,
        notes: data.notes || null,
      });
      setContact(updated);
      toast({ title: t("crm.contacts.updated") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setSaving(false);
    }
  }

  async function addTag() {
    const tag = newTag.trim();
    if (!tag || !activeCompanyId) return;
    try {
      setTags(await contactsApi.addTag(activeCompanyId, contactId, tag));
      setNewTag("");
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  async function removeTag(tag: string) {
    if (!activeCompanyId) return;
    try {
      setTags(await contactsApi.removeTag(activeCompanyId, contactId, tag));
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  function openEmail() {
    if (!contact?.email) {
      toast({ variant: "destructive", title: t("crm.email.noEmail") });
      return;
    }
    setEmailForm({ to: contact.email, subject: "", body: "" });
    setEmailGoal("");
    setEmailOpen(true);
  }

  async function draftEmail() {
    if (!activeCompanyId || !emailGoal.trim()) return;
    setDrafting(true);
    try {
      const draft = await crmEmailsApi.draft(activeCompanyId, { contactId, goal: emailGoal.trim() });
      setEmailForm((f) => ({ ...f, subject: draft.subject, body: draft.body }));
      toast({ title: t("crm.email.drafted") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setDrafting(false);
    }
  }

  async function sendEmail() {
    if (!activeCompanyId || !emailForm.to.trim() || !emailForm.subject.trim() || !emailForm.body.trim()) return;
    setSendingEmail(true);
    try {
      await crmEmailsApi.send(activeCompanyId, {
        contactId,
        toEmail: emailForm.to.trim(),
        subject: emailForm.subject.trim(),
        body: emailForm.body,
      });
      setEmailOpen(false);
      toast({ title: t("crm.email.sent") });
      setTimeline(await contactsApi.timeline(activeCompanyId, contactId).catch(() => timeline));
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setSendingEmail(false);
    }
  }

  function timelineLabel(item: TimelineItem): string {
    switch (item.type) {
      case "lead": return t("crm.timeline.leadCaptured") + (item.detail ? ` · ${item.detail}` : "");
      case "handoff": return t("crm.timeline.handoff");
      case "deal_created": return t("crm.timeline.dealCreated") + (item.detail ? ` · ${item.detail}` : "");
      case "deal_won": return t("crm.timeline.dealWon");
      case "deal_lost": return t("crm.timeline.dealLost");
      case "deal_stage": return `${t("crm.timeline.movedTo")} ${item.detail ?? ""}`.trim();
      case "meeting": return t("crm.timeline.meeting") + (item.detail ? ` · ${item.detail}` : "");
      case "email": return t("crm.timeline.email") + (item.detail ? ` · ${item.detail}` : "");
      case "task_done": return t("crm.timeline.taskDone") + (item.detail ? ` · ${item.detail}` : "");
      default: return item.title;
    }
  }

  if (isLoading) return <PageLoader />;
  if (!contact) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${locale}/crm/contacts`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{contact.name || t("crm.contacts.anonymous")}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t(`crm.statuses.${contact.status}`)}</Badge>
            {contact.ownerName && <span className="text-xs text-muted-foreground">{contact.ownerName}</span>}
          </div>
        </div>
        <Button variant="outline" onClick={openEmail}>
          <Mail className="mr-2 h-4 w-4" /> {t("crm.email.compose")}
        </Button>
      </div>

      {contact.needsReviewDuplicate && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("crm.contacts.duplicateWarning")}</span>
        </div>
      )}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t("crm.contacts.tabDetails")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("crm.contacts.tabTimeline")}</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t("crm.contacts.name")}</Label>
                    <Input {...register("name")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("crm.contacts.status")}</Label>
                    <Select value={watch("status")} onValueChange={(v) => setValue("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`crm.statuses.${s}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("crm.contacts.email")}</Label>
                    <Input type="email" {...register("email")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("crm.contacts.phone")}</Label>
                    <Input {...register("phone")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("crm.contacts.owner")}</Label>
                    <Select value={watch("ownerUserId") || "none"} onValueChange={(v) => setValue("ownerUserId", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("crm.contacts.noOwner")}</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.userId} value={String(m.userId)}>{m.firstName} {m.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("crm.contacts.estimatedValue")}</Label>
                    <Input type="number" step="0.01" {...register("estimatedValue")} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{t("crm.contacts.tags")}</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="ml-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <div className="flex items-center gap-1">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                        placeholder={t("crm.contacts.addTag")}
                        className="h-8 w-[160px]"
                      />
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={addTag}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{t("crm.contacts.notes")}</Label>
                  <textarea className={textareaClass} {...register("notes")} />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={saving}>
                    {saving && <LoadingSpinner size="sm" className="mr-2" />}
                    {t("crm.contacts.save")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {timeline.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t("crm.contacts.timelineEmpty")}</p>
              ) : (
                <div className="space-y-4">
                  {timeline.map((item, i) => {
                    const Icon = TIMELINE_ICON[item.type] ?? Briefcase;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">{timelineLabel(item)}</p>
                          {item.type === "handoff" && item.detail && (
                            <p className="text-xs italic text-muted-foreground">&ldquo;{item.detail}&rdquo;</p>
                          )}
                          <p className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("crm.email.compose")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-lg border border-dashed p-3">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> {t("crm.email.goal")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={emailGoal}
                  onChange={(e) => setEmailGoal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); draftEmail(); } }}
                  placeholder={t("crm.email.goalPlaceholder")}
                />
                <Button type="button" variant="secondary" onClick={draftEmail} disabled={drafting || !emailGoal.trim()}>
                  {drafting ? <LoadingSpinner size="sm" className="mr-2" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {drafting ? t("crm.email.drafting") : t("crm.email.draftWithAi")}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("crm.email.to")}</Label>
              <Input type="email" value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("crm.email.subject")}</Label>
              <Input value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("crm.email.body")}</Label>
              <textarea
                className={textareaClass + " min-h-[180px]"}
                value={emailForm.body}
                onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>{t("crm.email.cancel")}</Button>
            <Button
              onClick={sendEmail}
              disabled={sendingEmail || !emailForm.to.trim() || !emailForm.subject.trim() || !emailForm.body.trim()}
            >
              {sendingEmail && <LoadingSpinner size="sm" className="mr-2" />}
              {t("crm.email.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
