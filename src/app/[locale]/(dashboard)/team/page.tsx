"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Crown, Shield, User, CheckCircle2, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch, adminApi, type SystemAdminInvitation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
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
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
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
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setSaving(false);
    }
  }

  async function deleteInvitation(id: number) {
    try {
      await adminApi.deleteInvitation(id);
      toast({ title: t("common.success") });
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("superAdmin.platformTeam")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.invitations.title")}</p>
        </div>
        <Button onClick={() => { reset(); setDialogOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> {t("superAdmin.inviteAdmin")}
        </Button>
      </div>

      {invitations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("team.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {invitations.map((inv) => {
            const accepted = !!inv.acceptedAt;
            const expired = !accepted && new Date(inv.expiresAt) < new Date();
            return (
              <Card key={inv.id} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    {accepted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-500" />
                    )}
                    <div>
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {accepted
                          ? `${t("admin.invitations.accepted")} · ${new Date(inv.acceptedAt!).toLocaleDateString()}`
                          : expired
                          ? "Expired"
                          : `${t("admin.invitations.pending")} · Expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Shield className="h-3 w-3" />
                      Super Admin
                    </Badge>
                    <Badge variant={accepted ? "success" : expired ? "outline" : "warning"}>
                      {accepted
                        ? t("admin.invitations.accepted")
                        : expired
                        ? "Expired"
                        : t("admin.invitations.pending")}
                    </Badge>
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
                              Revoke invitation for {inv.email}?
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
                </CardContent>
              </Card>
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
      toast({ title: "Invitation sent" });
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
        <h1 className="text-3xl font-bold tracking-tight">{t("team.title")}</h1>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("onboarding.createCompany")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{t("team.title")}</h1>
        {isAdmin && (
          <Button size="sm" onClick={() => { reset(); setDialogOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> {t("team.invite")}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {members.map((member) => {
          const Icon = ROLE_ICON[member.role] ?? User;
          return (
            <Card key={member.userId} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {member.firstName[0]}
                  </div>
                  <div>
                    <p className="font-medium">{member.firstName} {member.lastName}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Icon className="h-3 w-3" />
                    {t(`team.roles.${member.role}`)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {invites.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Pending invitations</p>
          {invites.map((inv) => (
            <Card key={inv.id} className="opacity-70">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`team.roles.${inv.role}`)} · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="warning">{t("team.invitePending")}</Badge>
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
                          <AlertDialogDescription>Revoke invitation for {inv.email}?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeInvitation(inv.id)}>Revoke</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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
