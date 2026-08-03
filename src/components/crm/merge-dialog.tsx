"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { contactsApi, type Contact } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { SkeletonRows } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Merge, Mail, Phone } from "lucide-react";

/**
 * Resolves the "possible duplicate" flag: lists candidates and folds the chosen
 * one into this contact. The primary keeps every value it already has; only its
 * blank fields are filled from the duplicate.
 */
export function MergeDialog({
  open,
  onOpenChange,
  companyId,
  contact,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  contact: Contact;
  onMerged: (merged: Contact) => void;
}) {
  const t = useTranslations();
  const [candidates, setCandidates] = useState<Contact[] | null>(null);
  const [mergingId, setMergingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCandidates(null);
    (async () => {
      try {
        const list = await contactsApi.duplicates(companyId, contact.id);
        if (!cancelled) setCandidates(list);
      } catch {
        if (!cancelled) {
          setCandidates([]);
          toast({ variant: "destructive", title: t("errors.generic") });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, companyId, contact.id, t]);

  async function merge(duplicate: Contact) {
    setMergingId(duplicate.id);
    try {
      const merged = await contactsApi.merge(companyId, contact.id, duplicate.id);
      toast({ title: t("crm.merge.merged") });
      onMerged(merged);
      onOpenChange(false);
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setMergingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("crm.merge.title")}</DialogTitle>
          <DialogDescription>{t("crm.merge.description")}</DialogDescription>
        </DialogHeader>

        {/* The record that survives */}
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("crm.merge.keeping")}
          </p>
          <p className="mt-1 font-medium">{contact.name || t("crm.contacts.anonymous")}</p>
          <p className="text-sm text-muted-foreground">
            {[contact.email, contact.phone].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("crm.merge.candidates")}
          </p>

          {candidates === null ? (
            <SkeletonRows rows={3} />
          ) : candidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("crm.merge.none")}
            </p>
          ) : (
            candidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{c.name || t("crm.contacts.anonymous")}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {t(`crm.statuses.${c.status}`)}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={mergingId !== null} className="shrink-0">
                      {mergingId === c.id ? <LoadingSpinner size="sm" /> : <><Merge className="mr-1 h-3.5 w-3.5" />{t("crm.merge.action")}</>}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("crm.merge.confirmTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("crm.merge.confirmDescription", {
                          duplicate: c.name || t("crm.contacts.anonymous"),
                          primary: contact.name || t("crm.contacts.anonymous"),
                        })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("crm.pipeline.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => merge(c)}>
                        {t("crm.merge.action")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
