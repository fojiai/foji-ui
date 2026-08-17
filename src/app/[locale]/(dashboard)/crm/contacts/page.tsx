"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import {
  contactsApi,
  membersApi,
  subscriptionsApi,
  type Contact,
  type CompanyMember,
  type ContactInput,
  apiErrorMessage,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "@/hooks/use-toast";
import {
  Contact2, Plus, Search, AlertTriangle, X, MoreHorizontal,
  ArrowUpDown, Eye, Users, Upload, Download,
} from "lucide-react";
import { ContactImportDialog } from "@/components/crm/contact-import-dialog";
import { toCsv, downloadCsv } from "@/lib/csv";

const STATUSES = ["New", "Open", "Qualified", "Customer", "Unqualified", "Archived"];
type SortKey = "name" | "status" | "owner" | "lastActivity";

export default function ContactsPage() {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const { activeCompanyId } = useAuth();
  const locale = (useParams().locale as string) ?? "pt-br";

  const [hasCrm, setHasCrm] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ContactInput>({ status: "New" });

  const fetchContacts = useCallback(
    async (opts?: { status?: string; owner?: string; search?: string }) => {
      if (!activeCompanyId) return;
      const status = opts?.status ?? statusFilter;
      const owner = opts?.owner ?? ownerFilter;
      const q = opts?.search ?? search;
      const params: { ownerUserId?: number; status?: string; search?: string } = {};
      if (status !== "all") params.status = status;
      if (owner !== "all") params.ownerUserId = Number(owner);
      if (q.trim()) params.search = q.trim();

      setIsFetching(true);
      try {
        setContacts(await contactsApi.list(activeCompanyId, params));
        setSelected(new Set());
      } catch (err) {
        toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
      } finally {
        setIsFetching(false);
      }
    },
    [activeCompanyId, statusFilter, ownerFilter, search, t]
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
          const [list, memberList] = await Promise.all([
            contactsApi.list(activeCompanyId, {}),
            membersApi.list(activeCompanyId).catch(() => []),
          ]);
          if (cancelled) return;
          setContacts(list);
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

  // Debounced search — the old page only searched on Enter.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchContacts({ search: value }), 350);
  }

  const sorted = useMemo(() => {
    const val = (c: Contact) => {
      switch (sort.key) {
        case "status": return c.status ?? "";
        case "owner": return c.ownerName ?? "";
        case "lastActivity": return c.lastActivityAt ?? "";
        default: return c.name ?? "";
      }
    };
    return [...contacts].sort((a, b) => {
      const r = val(a).localeCompare(val(b), locale, { sensitivity: "base" });
      return sort.dir === "asc" ? r : -r;
    });
  }, [contacts, sort, locale]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const allSelected = sorted.length > 0 && selected.size === sorted.length;
  const headerState: boolean | "indeterminate" =
    allSelected ? true : selected.size > 0 ? "indeterminate" : false;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sorted.map((c) => c.id)));
  }
  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /** Bulk edit via the existing per-contact update endpoint. */
  async function bulkUpdate(patch: ContactInput) {
    if (!activeCompanyId || selected.size === 0) return;
    setBulkSaving(true);
    const ids = [...selected];
    try {
      const results = await Promise.allSettled(
        ids.map((id) => contactsApi.update(activeCompanyId, id, patch))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      await fetchContacts();
      if (failed > 0) {
        toast({ variant: "destructive", title: t("crm.contacts.bulkPartial", { failed }) });
      } else {
        toast({ title: t("crm.contacts.bulkUpdated", { count: ids.length }) });
      }
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setBulkSaving(false);
    }
  }

  function exportCsv() {
    const headers = ["nome", "email", "telefone", "status", "responsavel", "etiquetas", "criado_em"];
    const rows = sorted.map((c) => [
      c.name ?? "",
      c.email ?? "",
      c.phone ?? "",
      t(`crm.statuses.${c.status}`),
      c.ownerName ?? "",
      c.tags.join(", "),
      c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : "",
    ]);
    downloadCsv(`contatos-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(headers, rows));
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
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <PageLoader />;

  if (!hasCrm) {
    return (
      <div className="space-y-6 foji-enter">
        <PageHeader
          eyebrow={t("crm.eyebrow")}
          title={t("crm.contacts.title")}
          description={t("crm.contacts.description")}
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

  const SortHead = ({ label, sortKey, className }: { label: string; sortKey: SortKey; className?: string }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${sort.key === sortKey ? "text-foreground" : "opacity-40"}`} />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          eyebrow={t("crm.eyebrow")}
          title={t("crm.contacts.title")}
          description={t("crm.contacts.description")}
          className="flex-1"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="type-readout px-2.5 py-1 text-xs">
            {contacts.length} <span className="ml-1 font-sans">{t("crm.contacts.total")}</span>
          </Badge>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" /> {t("crm.import.action")}
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={sorted.length === 0}>
            <Download className="mr-1 h-4 w-4" /> {t("crm.import.export")}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t("crm.contacts.new")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("crm.contacts.search")}
            className="w-full pl-8 pr-8 sm:w-[260px]"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label={t("crm.contacts.clearSearch")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); fetchContacts({ status: v }); }}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder={t("crm.contacts.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("crm.contacts.allStatuses")}</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`crm.statuses.${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={(v) => { setOwnerFilter(v); fetchContacts({ owner: v }); }}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder={t("crm.contacts.filterByOwner")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("crm.contacts.allOwners")}</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={String(m.userId)}>{m.firstName} {m.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-primary" />
            {t("crm.contacts.selected", { count: selected.size })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Select disabled={bulkSaving} onValueChange={(v) => bulkUpdate({ status: v })}>
              <SelectTrigger className="h-8 w-[170px]">
                <SelectValue placeholder={t("crm.contacts.bulkStatus")} />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(`crm.statuses.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select
              disabled={bulkSaving}
              onValueChange={(v) => bulkUpdate({ ownerUserId: v === "none" ? null : Number(v) })}
            >
              <SelectTrigger className="h-8 w-[190px]">
                <SelectValue placeholder={t("crm.contacts.bulkOwner")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("crm.contacts.noOwner")}</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={String(m.userId)}>{m.firstName} {m.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bulkSaving && <LoadingSpinner size="sm" />}
          </div>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
            {t("crm.contacts.clearSelection")}
          </Button>
        </div>
      )}

      {/* Table */}
      {isFetching ? (
        <SkeletonRows rows={6} />
      ) : sorted.length === 0 ? (
        <EmptyState
          eyebrow={t("emptyStates.eyebrowNothingYet")}
          title={t("crm.contacts.empty")}
          description={t("crm.contacts.emptyHint")}
          action={
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-1 h-4 w-4" /> {t("crm.import.action")}
            </Button>
          }
        />
      ) : (
        <div className="plate overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-3">
                  <Checkbox
                    checked={headerState}
                    onCheckedChange={toggleAll}
                    aria-label={t("crm.contacts.selectAll")}
                  />
                </TableHead>
                <SortHead label={t("crm.contacts.name")} sortKey="name" />
                <TableHead className="hidden md:table-cell">{t("crm.contacts.email")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("crm.contacts.phone")}</TableHead>
                <SortHead label={t("crm.contacts.status")} sortKey="status" />
                <SortHead label={t("crm.contacts.owner")} sortKey="owner" className="hidden sm:table-cell" />
                <SortHead label={t("crm.contacts.lastActivity")} sortKey="lastActivity" className="hidden xl:table-cell" />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => (
                <TableRow
                  key={c.id}
                  data-state={selected.has(c.id) ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => router.push(`/${locale}/crm/contacts/${c.id}`)}
                >
                  <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleOne(c.id)}
                      aria-label={c.name ?? t("crm.contacts.anonymous")}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name || t("crm.contacts.anonymous")}</span>
                      {c.needsReviewDuplicate && (
                        <span title={t("crm.contacts.duplicateWarning")}>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                        </span>
                      )}
                    </div>
                    {c.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                        ))}
                        {c.tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{c.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    <div className="mt-0.5 text-xs text-muted-foreground md:hidden">{c.email || c.phone}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{c.email || "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{c.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="whitespace-nowrap">{t(`crm.statuses.${c.status}`)}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {c.ownerName || "—"}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground whitespace-nowrap">
                    {c.lastActivityAt
                      ? format.dateTime(new Date(c.lastActivityAt), { dateStyle: "short" })
                      : "—"}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">{t("crm.contacts.actions")}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t("crm.contacts.actions")}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/${locale}/crm/contacts/${c.id}`}>
                            <Eye className="h-4 w-4" /> {t("crm.contacts.view")}
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {activeCompanyId && (
        <ContactImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          companyId={activeCompanyId}
          onImported={() => fetchContacts()}
        />
      )}

      {/* Create dialog */}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("crm.contacts.email")}</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("crm.contacts.phone")}</Label>
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
