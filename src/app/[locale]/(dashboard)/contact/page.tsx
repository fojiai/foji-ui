"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Send, Clock, Check, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LoadingSpinner, PageLoader } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactSubmission {
  id: number;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  isResolved: boolean;
  adminNotes: string | null;
  createdAt: string;
}

// ─── Super Admin View ─────────────────────────────────────────────────────────

function SuperAdminContactView() {
  const t = useTranslations();
  const [contacts, setContacts] = useState<ContactSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showResolved, setShowResolved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<ContactSubmission | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ items: ContactSubmission[]; total: number }>
        (`/api/admin/contacts?resolved=${showResolved}&page=${page}&pageSize=${PAGE_SIZE}`);
      setContacts(data.items);
      setTotal(data.total);
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setIsLoading(false);
    }
  }, [page, showResolved, t]);

  useEffect(() => { load(); }, [load]);

  async function toggleResolved(contact: ContactSubmission) {
    try {
      await apiFetch(`/api/admin/contacts/${contact.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isResolved: !contact.isResolved }),
      });
      await load();
      toast({ title: t("common.success") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  async function saveNotes() {
    if (!selected) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/contacts/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ adminNotes }),
      });
      toast({ title: t("common.success") });
      setSelected(null);
      await load();
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const CATEGORY_COLORS: Record<string, string> = {
    bug: "destructive",
    feature: "default",
    billing: "warning",
    other: "secondary",
  };

  if (isLoading && contacts.length === 0) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("contact.adminTitle")}</h1>
          <p className="text-muted-foreground mt-1">{total} {t("contact.submissions")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={!showResolved ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowResolved(false); setPage(1); }}
          >
            <Clock className="mr-1 h-4 w-4" /> {t("contact.open")}
          </Button>
          <Button
            variant={showResolved ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowResolved(true); setPage(1); }}
          >
            <Check className="mr-1 h-4 w-4" /> {t("contact.resolved")}
          </Button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MessageSquare className="mx-auto h-8 w-8 mb-3 opacity-50" />
            <p>{showResolved ? t("contact.noResolved") : t("contact.noOpen")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contacts.map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={(CATEGORY_COLORS[c.category] ?? "secondary") as any}>
                        {c.category}
                      </Badge>
                      <span className="font-medium text-sm">{c.subject}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.name} ({c.email}) · {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{c.message}</p>
                    {c.adminNotes && (
                      <p className="text-xs text-primary mt-1">Note: {c.adminNotes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSelected(c); setAdminNotes(c.adminNotes ?? ""); }}
                    >
                      {t("contact.viewDetails")}
                    </Button>
                    <Button
                      variant={c.isResolved ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleResolved(c)}
                    >
                      {c.isResolved ? t("contact.reopen") : t("contact.resolve")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.subject}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {selected.name} ({selected.email}) · {new Date(selected.createdAt).toLocaleString()}
                </p>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Badge variant={(CATEGORY_COLORS[selected.category] ?? "secondary") as any}>
                    {selected.category}
                  </Badge>
                </div>

                <div className="rounded-lg border border-border p-3 text-sm whitespace-pre-wrap bg-muted/30">
                  {selected.message}
                </div>

                <div className="space-y-2">
                  <Label>{t("contact.adminNotesLabel")}</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder={t("contact.adminNotesPlaceholder")}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>{t("common.cancel")}</Button>
                <Button onClick={saveNotes} disabled={saving}>
                  {saving ? <LoadingSpinner size="sm" /> : t("common.save")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Regular User Contact Form ────────────────────────────────────────────────

const formSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
});
type FormData = z.infer<typeof formSchema>;

function RegularContactView() {
  const t = useTranslations("contact");
  const tc = useTranslations("common");
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user ? `${user.firstName} ${user.lastName}`.trim() : "",
      category: "bug",
    },
  });

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      await apiFetch("/api/contact", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ variant: "destructive", title: (err.data as any)?.error ?? t("error") });
      } else {
        toast({ variant: "destructive", title: t("error") });
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-semibold">{t("successTitle")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("successDescription")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("formTitle")}</CardTitle>
            <CardDescription>{t("formDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{tc("name")}</Label>
              <Input {...register("name")} aria-invalid={!!errors.name} />
            </div>

            <div className="space-y-2">
              <Label>{t("category")}</Label>
              <Select value={watch("category")} onValueChange={(v) => setValue("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bug">{t("categories.bug")}</SelectItem>
                  <SelectItem value="feature">{t("categories.feature")}</SelectItem>
                  <SelectItem value="billing">{t("categories.billing")}</SelectItem>
                  <SelectItem value="other">{t("categories.other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("subject")}</Label>
              <Input {...register("subject")} placeholder={t("subjectPlaceholder")} aria-invalid={!!errors.subject} />
              {errors.subject && <p className="text-xs text-destructive">{t("subjectRequired")}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t("message")}</Label>
              <textarea
                className="flex min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder={t("messagePlaceholder")}
                {...register("message")}
                aria-invalid={!!errors.message}
              />
              {errors.message && <p className="text-xs text-destructive">{t("messageRequired")}</p>}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                <Send className="mr-1 h-4 w-4" />
                {t("send")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function ContactPage() {
  const { user } = useAuth();

  if (user?.isSuperAdmin) return <SuperAdminContactView />;
  return <RegularContactView />;
}
