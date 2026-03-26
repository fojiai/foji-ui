"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Search, Plus, Building2, User, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { adminCompaniesApi, type AdminCompanyListItem, type AccountType } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "@/hooks/use-toast";

const createSchema = z.object({
  name: z.string().min(1),
  tradeName: z.string().optional(),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  accountType: z.enum(["Business", "Individual"]),
  cpfCnpj: z.string().optional(),
  description: z.string().optional(),
  adminNotes: z.string().optional(),
  ownerEmail: z.string().email(),
  ownerFirstName: z.string().optional(),
  ownerLastName: z.string().optional(),
});
type CreateForm = z.infer<typeof createSchema>;

const PAGE_SIZE = 20;

export default function AdminCompaniesPage() {
  const t = useTranslations();
  const [companies, setCompanies] = useState<AdminCompanyListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { accountType: "Business" },
  });

  const load = useCallback(async (q: string, p: number) => {
    setIsLoading(true);
    try {
      const data = await adminCompaniesApi.list(q || undefined, p, PAGE_SIZE);
      setCompanies(data.items);
      setTotal(data.total);
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setIsLoading(false); }
  }, [t]);

  useEffect(() => { load(search, page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(search, 1);
  }

  async function onCreate(data: CreateForm) {
    setSaving(true);
    try {
      const { id } = await adminCompaniesApi.create(data);
      toast({ title: `Company created (id=${id})` });
      reset();
      setDialogOpen(false);
      await load(search, page);
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setSaving(false); }
  }

  // Auto-generate slug from name
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setValue("name", val);
    setValue("slug", val.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("admin.companies.title")} <span className="text-muted-foreground text-sm font-normal">({total})</span></h2>
        <Button size="sm" onClick={() => { reset(); setDialogOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> New Account
        </Button>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, slug, CPF/CNPJ or owner email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      {isLoading ? <PageLoader /> : (
        <>
          <div className="space-y-2">
            {companies.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">No companies found.</CardContent></Card>
            ) : companies.map((c) => (
              <Card key={c.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                      {c.accountType === "Individual"
                        ? <User className="h-4 w-4 text-muted-foreground" />
                        : <Building2 className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{c.name}</p>
                        {c.tradeName && c.tradeName !== c.name && (
                          <span className="text-xs text-muted-foreground">({c.tradeName})</span>
                        )}
                        <Badge variant={c.accountType === "Individual" ? "secondary" : "outline"} className="text-xs">
                          {c.accountType === "Individual" ? "PF" : "PJ"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.slug} · {c.ownerEmail}
                        {c.cpfCnpj && ` · ${c.cpfCnpj}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <div className="text-right hidden sm:block">
                      {c.hasActiveSubscription ? (
                        <Badge variant="success">{c.currentPlanName}</Badge>
                      ) : (
                        <Badge variant="outline">No plan</Badge>
                      )}
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`admin/companies/${c.id}`}>Manage</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
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
        </>
      )}

      {/* Create company dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={watch("accountType")} onValueChange={(v) => setValue("accountType", v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Business">Pessoa Jurídica (Business)</SelectItem>
                  <SelectItem value="Individual">Pessoa Física (Individual)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input
                  {...register("name")}
                  onChange={handleNameChange}
                  placeholder={watch("accountType") === "Individual" ? "Full legal name" : "Company name"}
                  aria-invalid={!!errors.name}
                />
              </div>
              <div className="space-y-2">
                <Label>Trade / Fantasy Name</Label>
                <Input {...register("tradeName")} placeholder="Optional" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slug <span className="text-destructive">*</span></Label>
                <Input {...register("slug")} aria-invalid={!!errors.slug} />
                {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>{watch("accountType") === "Individual" ? "CPF" : "CNPJ"}</Label>
                <Input
                  {...register("cpfCnpj")}
                  placeholder={watch("accountType") === "Individual" ? "00000000000" : "00000000000000"}
                  maxLength={watch("accountType") === "Individual" ? 11 : 14}
                />
              </div>
            </div>

            <div className="space-y-1 border-t pt-4">
              <p className="text-sm font-medium">Owner Account</p>
              <p className="text-xs text-muted-foreground mb-3">
                If the email doesn&apos;t exist yet, a new user will be created. You&apos;ll need to send them an invitation link to set their password.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Owner Email <span className="text-destructive">*</span></Label>
              <Input type="email" {...register("ownerEmail")} aria-invalid={!!errors.ownerEmail} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name <span className="text-muted-foreground text-xs">(if new user)</span></Label>
                <Input {...register("ownerFirstName")} />
              </div>
              <div className="space-y-2">
                <Label>Last Name <span className="text-muted-foreground text-xs">(if new user)</span></Label>
                <Input {...register("ownerLastName")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Admin Notes</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Payment arrangement, referral source, custom deal details…"
                {...register("adminNotes")}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <LoadingSpinner size="sm" /> : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
