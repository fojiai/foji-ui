"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Plus, Trash2, Crown, Shield, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch, adminApi, type SystemAdminInvitation, apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, NoCompanyState } from "@/components/shared/empty-state";
import { HeatStatus } from "@/components/shared/heat";
import { toast } from "@/hooks/use-toast";

// ─── Shared types ────────────────────────────────────────────────────────────

interface Member {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "owner" | "admin" | "user";
}

interface Invite {
  id: number;
  email: string;
  role: string;
  expiresAt: string;
}

// ─── Super Admin Team View ───────────────────────────────────────────────────

const adminInviteSchema = z.object({ email: z.string().email() });
type AdminInviteForm = z.infer<typeof adminInviteSchema>;

function SuperAdminTeamView() {
  const t = useTranslations();
  const format = useFormatter();
  const [invitations, setInvitations] = useState<SystemAdminInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AdminInviteForm>({
    resolver: zodResolver(adminInviteSchema),
  });

  async function load() {
    setIsLoading(true);
    try {
      setInvitations(await adminApi.listInvitations());
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: AdminInviteForm) {
    setSaving(true);
    try {
      await adminApi.inviteAdmin(data.email);
      toast({ title: t("common.success") });
      reset();
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvitation(id: number) {
    try {
      await adminApi.deleteInvitation(id);
      toast({ title: t("common.success") });
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("emptyStates.eyebrowAdmin")}
        title={t("superAdmin.platformTeam")}
        description={t("admin.invitations.title")}
        action={
          <Button onClick={() => { reset(); setDialogOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> {t("superAdmin.inviteAdmin")}
          </Button>
        }
      />

      {invitations.length === 0 ? (
        <EmptyState
          eyebrow={t("emptyStates.eyebrowNothingYet")}
          title={t("team.empty")}
          description={t("team.emptyHint")}
        />
      ) : (
        <div className="plate divide-y overflow-hidden rounded-xl border bg-card">
          {invitations.map((inv) => {
            const accepted = !!inv.acceptedAt;
            const expired = !accepted && new Date(inv.expiresAt) < new Date();
            return (
              <div key={inv.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div>
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {accepted
                          ? `${t("admin.invitations.accepted")} · ${format.dateTime(new Date(inv.acceptedAt!), { dateStyle: "short" })}`
                          : expired
                          ? t("team.inviteExpired")
                          : t("team.inviteExpiresOn", {
                              date: format.dateTime(new Date(inv.expiresAt), { dateStyle: "short" }),
                            })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Role is a category, so it stays iron. */}
                    <Badge variant="secondary" className="gap-1">
                      <Shield className="h-3 w-3" />
                      {t("team.roles.superAdmin")}
                    </Badge>
                    {/* One device for the invitation state — the icon and the
                        badge used to say the same thing side by side. */}
                    <HeatStatus
                      level={accepted ? "cool" : "attention"}
                      label={
                        accepted
                          ? t("admin.invitations.accepted")
                          : expired
                          ? t("team.inviteExpired")
                          : t("admin.invitations.pending")
                      }
                    />
                    {!accepted && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("common.confirm")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {t("team.revokeConfirm", { email: inv.email })}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteInvitation(inv.id)}>
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("superAdmin.inviteAdmin")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.email")}</Label>
              <Input
                type="email"
                placeholder="admin@example.com"
                {...register("email")}
                aria-invalid={!!errors.email}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <LoadingSpinner size="sm" /> : t("superAdmin.inviteAdmin")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Regular Team View (tenant-scoped) ───────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
});
type InviteForm = z.infer<typeof inviteSchema>;

const ROLE_ICON: Record<string, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  user: User,
};

function RegularTeamView() {
  const t = useTranslations();
  const format = useFormatter();
  const { activeCompanyId, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: "user" },
  });

  async function load() {
    if (!activeCompanyId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const [mem, inv] = await Promise.all([
        apiFetch<Member[]>(`/api/companies/${activeCompanyId}/members`),
        apiFetch<Invite[]>(`/api/companies/${activeCompanyId}/invitations`),
      ]);
      setMembers(mem);
      setInvites(inv.filter((i) => !i.expiresAt || new Date(i.expiresAt) > new Date()));
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { load(); }, [activeCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onInvite(data: InviteForm) {
    if (!activeCompanyId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/companies/${activeCompanyId}/invitations`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      toast({ title: t("team.inviteSent") });
      reset();
      setDialogOpen(false);
      await load();
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setSaving(false); }
  }

  async function removeInvitation(id: number) {
    if (!activeCompanyId) return;
    try {
      await apiFetch(`/api/companies/${activeCompanyId}/invitations/${id}`, { method: "DELETE" });
      setInvites((prev) => prev.filter((i) => i.id !== id));
      toast({ title: t("common.success") });
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
  }

  // Check ownership from members list OR from JWT company role
  const memberRole = members.find((m) => m.userId === Number(user?.sub))?.role;
  const jwtRole = user?.companies?.find((c) => c.companyId === activeCompanyId)?.role;
  const isOwner = memberRole === "owner" || jwtRole === "owner";
  const isAdmin = isOwner || memberRole === "admin" || jwtRole === "admin";

  if (isLoading) return <PageLoader />;

  if (!activeCompanyId) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow={t("team.eyebrow")} title={t("team.title")} />
        <NoCompanyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("team.eyebrow")}
        title={t("team.title")}
        description={t("team.description")}
        action={
          isAdmin && (
            <Button onClick={() => { reset(); setDialogOpen(true); }}>
              <Plus className="mr-1 h-4 w-4" /> {t("team.invite")}
            </Button>
          )
        }
      />

      <div className="plate divide-y overflow-hidden rounded-xl border bg-card">
        {members.map((member) => {
          const Icon = ROLE_ICON[member.role] ?? User;
          return (
            <div key={member.userId} className="flex items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                {/* Iron, not ember: an initial is an identifier, not a state. */}
                <div className="type-readout flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-muted text-sm font-semibold text-muted-foreground">
                  {member.firstName[0]}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{member.firstName} {member.lastName}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              {/* Roles are categories, not heat. */}
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Icon className="h-3 w-3" />
                {t(`team.roles.${member.role}`)}
              </Badge>
            </div>
          );
        })}
      </div>

      {invites.length > 0 && (
        <div className="space-y-2">
          <p className="type-label text-muted-foreground">{t("team.pendingInvitations")}</p>
          {/* The card used to sit at 70% opacity, which pushed the muted
              metadata under AA. Pending-ness is the spark chip's job. */}
          <div className="plate divide-y overflow-hidden rounded-xl border bg-card">
          {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`team.roles.${inv.role}`)} ·{" "}
                    {t("team.inviteExpiresOn", {
                      date: format.dateTime(new Date(inv.expiresAt), { dateStyle: "short" }),
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <HeatStatus level="attention" label={t("team.invitePending")} />
                  {isOwner && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("common.confirm")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("team.revokeConfirm", { email: inv.email })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                          onClick={() => removeInvitation(inv.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t("team.revoke")}
                        </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
          ))}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("team.invite")}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(onInvite)} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("team.inviteEmail")}</Label>
              <Input type="email" {...register("email")} aria-invalid={!!errors.email} />
            </div>
            <div className="space-y-2">
              <Label>{t("team.role")}</Label>
              <Select value={watch("role")} onValueChange={(v) => setValue("role", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t("team.roles.admin")}</SelectItem>
                  <SelectItem value="user">{t("team.roles.user")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <LoadingSpinner size="sm" /> : t("team.invite")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { user } = useAuth();

  if (user?.isSuperAdmin) return <SuperAdminTeamView />;
  return <RegularTeamView />;
}
