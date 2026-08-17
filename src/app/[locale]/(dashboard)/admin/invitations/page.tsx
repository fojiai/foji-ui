"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Plus, Trash2, CheckCircle2, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { adminApi, type SystemAdminInvitation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { HeatStatus } from "@/components/shared/heat";
import { toast } from "@/hooks/use-toast";

const schema = z.object({ email: z.string().email() });
type FormData = z.infer<typeof schema>;

export default function InvitationsPage() {
  const t = useTranslations();
  const format = useFormatter();
  const [invitations, setInvitations] = useState<SystemAdminInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function load() {
    setIsLoading(true);
    try { setInvitations(await adminApi.listInvitations()); } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      await adminApi.inviteAdmin(data.email);
      toast({ title: t("common.success") });
      reset();
      setDialogOpen(false);
      await load();
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
    finally { setSaving(false); }
  }

  async function deleteInvitation(id: number) {
    try {
      await adminApi.deleteInvitation(id);
      toast({ title: t("common.success") });
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    } catch { toast({ variant: "destructive", title: t("errors.generic") }); }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="type-display text-xl">{t("admin.invitations.title")}</h2>
        <Button size="sm" onClick={() => { reset(); setDialogOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> {t("admin.invitations.invite")}
        </Button>
      </div>

      {invitations.length === 0 ? (
        <EmptyState
          eyebrow="Nothing yet"
          title="No system admin invitations"
          description="Invite an administrator to give them access to this panel."
        />
      ) : (
        <div className="plate divide-y overflow-hidden rounded-xl border bg-card">
          {invitations.map((inv) => {
            const accepted = !!inv.acceptedAt;
            const expired = !accepted && new Date(inv.expiresAt) < new Date();
            return (
              <div key={inv.id}>
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited by {inv.invitedByUserEmail}
                        {accepted ? (
                          <> · Accepted <span className="type-readout">{format.dateTime(new Date(inv.acceptedAt!), { dateStyle: "short" })}</span></>
                        ) : expired ? (
                          <> · Expired</>
                        ) : (
                          <> · Expires <span className="type-readout">{format.dateTime(new Date(inv.expiresAt), { dateStyle: "short" })}</span></>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Real lifecycle state, so this one earns HeatStatus:
                        pending waits on a human, accepted is settled,
                        expired is cold. */}
                    <HeatStatus
                      level={accepted ? "cool" : expired ? "idle" : "attention"}
                      label={
                        accepted
                          ? t("admin.invitations.accepted")
                          : expired
                          ? "Expired"
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
                              Revoke invitation for <strong>{inv.email}</strong>?
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
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("admin.invitations.invite")}</DialogTitle>
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
                {saving ? <LoadingSpinner size="sm" /> : t("admin.invitations.invite")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
