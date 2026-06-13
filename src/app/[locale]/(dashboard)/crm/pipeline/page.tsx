"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
} from "@dnd-kit/core";
import { useAuth } from "@/components/providers/auth-provider";
import {
  dealsApi, contactsApi, membersApi, subscriptionsApi,
  type Board, type DealCard, type Contact, type CompanyMember, type CreateDealInput,
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
import { Plus, Lock, GripVertical } from "lucide-react";

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function DealCardItem({ deal }: { deal: DealCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-card p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{deal.title}</p>
        <button {...listeners} {...attributes} className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-sm font-semibold text-primary">{formatMoney(deal.value, deal.currency)}</p>
      {deal.contactName && <p className="mt-0.5 text-xs text-muted-foreground">{deal.contactName}</p>}
      {deal.ownerName && <p className="text-xs text-muted-foreground">{deal.ownerName}</p>}
    </div>
  );
}

function StageColumn({
  stageId, name, total, currency, children,
}: {
  stageId: number; name: string; total: number; currency: string; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 p-3 ${isOver ? "ring-2 ring-primary" : ""}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{name}</span>
        <Badge variant="outline" className="text-xs">{formatMoney(total, currency)}</Badge>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export default function PipelinePage() {
  const t = useTranslations();
  const { activeCompanyId } = useAuth();
  const locale = (useParams().locale as string) ?? "pt-br";
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [hasCrm, setHasCrm] = useState<boolean | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateDealInput>({ contactId: 0, title: "", value: 0, currency: "BRL" });

  const currency = board?.columns[0]?.deals[0]?.currency ?? "BRL";

  useEffect(() => {
    if (!activeCompanyId) return;
    async function load() {
      try {
        const sub = await subscriptionsApi.getSubscription(activeCompanyId!).catch(() => null);
        const enabled = sub?.plan?.hasCrm ?? false;
        setHasCrm(enabled);
        if (enabled) {
          const [b, contactList, memberList] = await Promise.all([
            dealsApi.board(activeCompanyId!),
            contactsApi.list(activeCompanyId!).catch(() => []),
            membersApi.list(activeCompanyId!).catch(() => []),
          ]);
          setBoard(b);
          setContacts(contactList);
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

  async function refreshBoard() {
    if (!activeCompanyId || !board) return;
    setBoard(await dealsApi.board(activeCompanyId, board.pipelineId));
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !activeCompanyId || !board) return;
    const dealId = Number(active.id);
    const toStageId = Number(over.id);
    const currentColumn = board.columns.find((c) => c.deals.some((d) => d.id === dealId));
    if (!currentColumn || currentColumn.stage.id === toStageId) return;

    // Optimistic move
    const moved = currentColumn.deals.find((d) => d.id === dealId)!;
    setBoard({
      ...board,
      columns: board.columns.map((c) => {
        if (c.stage.id === currentColumn.stage.id) return { ...c, deals: c.deals.filter((d) => d.id !== dealId) };
        if (c.stage.id === toStageId) return { ...c, deals: [moved, ...c.deals] };
        return c;
      }),
    });

    try {
      await dealsApi.move(activeCompanyId, dealId, toStageId);
      await refreshBoard();
      toast({ title: t("crm.pipeline.moved") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
      await refreshBoard();
    }
  }

  async function createDeal() {
    if (!activeCompanyId || !form.contactId || !form.title.trim()) return;
    setSaving(true);
    try {
      await dealsApi.create(activeCompanyId, form);
      setDialogOpen(false);
      setForm({ contactId: 0, title: "", value: 0, currency: "BRL" });
      await refreshBoard();
      toast({ title: t("crm.pipeline.created") });
    } catch {
      toast({ variant: "destructive", title: t("errors.generic") });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <PageLoader />;

  if (!hasCrm) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("crm.pipeline.title")}</h1>
          <p className="text-muted-foreground">{t("crm.pipeline.description")}</p>
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
          <h1 className="text-3xl font-bold tracking-tight">{t("crm.pipeline.title")}</h1>
          <p className="text-muted-foreground">{t("crm.pipeline.description")}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={contacts.length === 0}>
          <Plus className="mr-1 h-4 w-4" /> {t("crm.pipeline.newDeal")}
        </Button>
      </div>

      {contacts.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("crm.pipeline.noContacts")}</p>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {board?.columns.map((col) => (
            <StageColumn
              key={col.stage.id}
              stageId={col.stage.id}
              name={col.stage.name}
              total={col.total}
              currency={currency}
            >
              {col.deals.map((deal) => (
                <DealCardItem key={deal.id} deal={deal} />
              ))}
            </StageColumn>
          ))}
        </div>
      </DndContext>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("crm.pipeline.newDeal")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("crm.pipeline.dealTitle")}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("crm.pipeline.contact")}</Label>
              <Select
                value={form.contactId ? String(form.contactId) : ""}
                onValueChange={(v) => setForm({ ...form, contactId: Number(v) })}
              >
                <SelectTrigger><SelectValue placeholder={t("crm.pipeline.selectContact")} /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name || c.email || c.phone || `#${c.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("crm.pipeline.value")}</Label>
                <Input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("crm.pipeline.currency")}</Label>
                <Input value={form.currency ?? "BRL"} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("crm.pipeline.owner")}</Label>
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
              <div className="space-y-1.5">
                <Label>{t("crm.pipeline.expectedClose")}</Label>
                <Input
                  type="date"
                  value={form.expectedCloseDate ?? ""}
                  onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value || null })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("crm.pipeline.cancel")}</Button>
            <Button onClick={createDeal} disabled={saving || !form.contactId || !form.title.trim()}>
              {saving && <LoadingSpinner size="sm" className="mr-2" />}
              {t("crm.pipeline.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
