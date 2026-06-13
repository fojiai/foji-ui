"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import {
  contactsApi,
  membersApi,
  subscriptionsApi,
  type Contact,
  type CompanyMember,
  type ContactInput,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";
import { Contact2, Mail, Phone, Plus, Search, AlertTriangle, Lock } from "lucide-react";

const STATUSES = ["New", "Open", "Qualified", "Customer", "Unqualified", "Archived"];
const textareaClass =
  "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function ContactsPage() {
  const t = useTranslations();
  const { activeCompanyId } = useAuth();
  const locale = (useParams().locale as string) ?? "pt-br";

  const [hasCrm, setHasCrm] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ContactInput>({ status: "New" });

  async function loadContacts(companyId: number) {
    const params: { ownerUserId?: number; status?: string; search?: string } = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (ownerFilter !== "all") params.ownerUserId = Number(ownerFilter);
    if (search.trim()) params.search = search.trim();
    setContacts(await contactsApi.list(companyId, params));
  }

  useEffect(() => {
    if (!activeCompanyId) return;
    async function load() {
      try {
        const sub = await subscriptionsApi.getSubscription(activeCompanyId!).catch(() => null);
        const enabled = sub?.plan?.hasCrm ?? false;
        setHasCrm(enabled);
        if (enabled) {
          const [, memberList] = await Promise.all([
            loadContacts(activeCompanyId!),
            membersApi.list(activeCompanyId!).catch(() => []),
          ]);
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

  async function runSearch(next?: { status?: string; owner?: string; search?: string }) {
    if (!activeCompanyId) return;
    const status = next?.status ?? statusFilter;
    const owner = next?.owner ?? ownerFilter;
    const q = next?.search ?? search;
    const params: { ownerUserId?: number; status?: string; search?: string } = {};
    if (status !== "all") params.status = status;
    if (owner !== "all") params.ownerUserId = Number(owner);
    if (q.trim()) params.search = q.trim();
    try {
      setContacts(await contactsApi.list(activeCompanyId, params));
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  async function createContact() {
    if (!activeCompanyId) return;
    setSaving(true);
    try {
      const created = await contactsApi.create(activeCompanyId, form);
      setContacts((prev) => [created, ...prev]);
      setDialogOpen(false);
      setForm({ status: "New" });
      toast({ title: t("crm.contacts.created") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <PageLoader />;

  // Plan gate
  if (!hasCrm) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("crm.contacts.title")}</h1>
          <p className="text-muted-foreground">{t("crm.contacts.description")}</p>
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
          <h1 className="text-3xl font-bold tracking-tight">{t("crm.contacts.title")}</h1>
          <p className="text-muted-foreground">{t("crm.contacts.description")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm">
            {contacts.length} {t("crm.contacts.total")}
          </Badge>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t("crm.contacts.new")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch({ search })}
            placeholder={t("crm.contacts.search")}
            className="w-[260px] pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); runSearch({ status: v }); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("crm.contacts.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("crm.contacts.allStatuses")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{t(`crm.statuses.${s}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={(v) => { setOwnerFilter(v); runSearch({ owner: v }); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("crm.contacts.filterByOwner")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("crm.contacts.allOwners")}</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={String(m.userId)}>
                {m.firstName} {m.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Contact2 className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">{t("crm.contacts.empty")}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{t("crm.contacts.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <Link key={c.id} href={`/${locale}/crm/contacts/${c.id}`}>
              <Card className="transition-colors hover:bg-accent/40">
                <CardContent className="flex items-start justify-between py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Contact2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{c.name || t("crm.contacts.anonymous")}</p>
                        {c.needsReviewDuplicate && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        {c.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {c.email}</span>}
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {c.phone}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant="outline">{t(`crm.statuses.${c.status}`)}</Badge>
                    {c.ownerName && <span className="text-xs text-muted-foreground">{c.ownerName}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("crm.contacts.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("crm.contacts.name")}</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("crm.contacts.email")}</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("crm.contacts.phone")}</Label>
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("crm.contacts.status")}</Label>
                <Select value={form.status ?? "New"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`crm.statuses.${s}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("crm.contacts.owner")}</Label>
                <Select
                  value={form.ownerUserId ? String(form.ownerUserId) : "none"}
                  onValueChange={(v) => setForm({ ...form, ownerUserId: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("crm.contacts.noOwner")}</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.userId} value={String(m.userId)}>{m.firstName} {m.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("crm.contacts.notes")}</Label>
              <textarea className={textareaClass} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("crm.contacts.cancel")}</Button>
            <Button onClick={createContact} disabled={saving}>
              {saving && <LoadingSpinner size="sm" className="mr-2" />}
              {t("crm.contacts.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
