"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Crown, Shield, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api";
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

export default function TeamPage() {
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
    if (!activeCompanyId) return;
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

  const isOwner = user
    ? members.find((m) => m.userId === Number(user.sub))?.role === "owner"
    : false;

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("team.title")}</h1>
        {isOwner && (
          <Button size="sm" onClick={() => { reset(); setDialogOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> {t("team.invite")}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {members.map((member) => {
          const Icon = ROLE_ICON[member.role] ?? User;
          return (
            <Card key={member.userId}>
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
