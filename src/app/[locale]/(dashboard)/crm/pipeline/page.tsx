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
  apiErrorMessage,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "@/hooks/use-toast";
import { Plus, GripVertical, Settings2 } from "lucide-react";
import { StageManager } from "@/components/crm/stage-manager";
import { pipelineApi, type Pipeline } from "@/lib/api";

function formatMoney(value: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/**
 * Currency for a stage total. Deals carry their own currency, so a column can be
 * mixed — summing those into one number is meaningless. Report the single
 * currency when there is one, and flag the column otherwise.
 */
function columnCurrency(deals: DealCard[]): { code: string; mixed: boolean } {
  const codes = new Set(deals.map((d) => d.currency).filter(Boolean));
  if (codes.size === 0) return { code: "BRL", mixed: false };
  const [first] = [...codes];
  return { code: first, mixed: codes.size > 1 };
}

function DealCardItem({
  deal,
  locale,
  dragLabel,
}: {
  deal: DealCard;
  locale: string;
  dragLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="plate rounded-xl border bg-card p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/${locale}/crm/deals/${deal.id}`}
          className="text-sm font-medium leading-tight hover:underline"
        >
          {deal.title}
        </Link>
        <button
          {...listeners}
          {...attributes}
          aria-label={dragLabel}
          className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      {/* Money is a number, not a state. It used to be ember on every card,
          which spent the brand colour on the most repeated element on screen. */}
      <p className="type-readout mt-1 text-sm font-semibold">
        {formatMoney(deal.value, deal.currency, locale)}
      </p>
      {deal.contactName && <p className="mt-0.5 text-xs text-muted-foreground">{deal.contactName}</p>}
      {deal.ownerName && <p className="text-xs text-muted-foreground">{deal.ownerName}</p>}
    </div>
  );
}

function StageColumn({
  stageId, name, total, currency, mixed, locale, count, mixedLabel, children,
}: {
  stageId: number; name: string; total: number; currency: string; mixed: boolean;
  locale: string; count: number; mixedLabel: string; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId });
  return (
    /* The drop target is the one place ember belongs on this board: it marks
       what is live under the cursor, right now, and vanishes on release. */
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-muted/30 p-3 transition-colors ${
        isOver ? "border-primary/50 ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="type-label truncate text-foreground">{name}</span>
          <span className="type-readout rounded bg-muted px-1.5 text-xs text-muted-foreground">
            {count}
          </span>
        </span>
        <span
          className="type-readout shrink-0 text-xs text-muted-foreground"
          title={mixed ? mixedLabel : undefined}
        >
          {mixed ? "~" : ""}{formatMoney(total, currency, locale)}
        </span>
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
  const [stagesOpen, setStagesOpen] = useState(false);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateDealInput>({ contactId: 0, title: "", value: 0, currency: "BRL" });


  useEffect(() => {
    if (!activeCompanyId) return;
    async function load() {
      try {
        const sub = await subscriptionsApi.getSubscription(activeCompanyId!).catch(() => null);
        const enabled = sub?.plan?.hasCrm ?? false;
        setHasCrm(enabled);
        if (enabled) {
          const [b, contactList, memberList, pipes] = await Promise.all([
            dealsApi.board(activeCompanyId!),
            contactsApi.list(activeCompanyId!).catch(() => []),
            membersApi.list(activeCompanyId!).catch(() => []),
            pipelineApi.list(activeCompanyId!).catch(() => [] as Pipeline[]),
          ]);
          setBoard(b);
          setContacts(contactList);
          setMembers(memberList);
          setPipeline(pipes.find((x) => x.id === b.pipelineId) ?? null);
        }
      } catch (err) {
        toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
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

  /** Reload both the board and the pipeline definition after a stage edit. */
  async function refreshAfterStageChange() {
    if (!activeCompanyId || !board) return;
    const [b, pipes] = await Promise.all([
      dealsApi.board(activeCompanyId, board.pipelineId),
      pipelineApi.list(activeCompanyId).catch(() => [] as Pipeline[]),
    ]);
    setBoard(b);
    setPipeline(pipes.find((x) => x.id === b.pipelineId) ?? null);
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
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
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
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <PageLoader />;

  if (!hasCrm) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow={t("crm.eyebrow")}
          title={t("crm.pipeline.title")}
          description={t("crm.pipeline.description")}
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("crm.eyebrow")}
        title={t("crm.pipeline.title")}
        description={t("crm.pipeline.description")}
        action={
          <>
            <Button variant="outline" onClick={() => setStagesOpen(true)}>
              <Settings2 className="mr-1 h-4 w-4" /> {t("crm.stages.manage")}
            </Button>
            <Button onClick={() => setDialogOpen(true)} disabled={contacts.length === 0}>
              <Plus className="mr-1 h-4 w-4" /> {t("crm.pipeline.newDeal")}
            </Button>
          </>
        }
      />

      {contacts.length === 0 && (
        // A deal needs a contact, so the button above is disabled. Say why and
        // give the way out, instead of leaving a dead control on the page.
        // Spark, because this is the one thing on the board waiting on the user.
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-spark/35 bg-spark/10 p-3">
          <p className="text-sm text-spark-ink">{t("crm.pipeline.noContacts")}</p>
          <Button variant="outline" size="sm" asChild className="ml-auto">
            <Link href={`/${locale}/crm/contacts`}>{t("crm.pipeline.goToContacts")}</Link>
          </Button>
        </div>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {board?.columns.map((col) => {
            const { code, mixed } = columnCurrency(col.deals);
            return (
              <StageColumn
                key={col.stage.id}
                stageId={col.stage.id}
                name={col.stage.name}
                total={col.total}
                currency={code}
                mixed={mixed}
                locale={locale}
                count={col.deals.length}
                mixedLabel={t("crm.pipeline.mixedCurrencies")}
              >
                {col.deals.map((deal) => (
                  <DealCardItem
                    key={deal.id}
                    deal={deal}
                    locale={locale}
                    dragLabel={t("crm.pipeline.drag")}
                  />
                ))}
              </StageColumn>
            );
          })}
        </div>
      </DndContext>

      {activeCompanyId && (
        <StageManager
          open={stagesOpen}
          onOpenChange={setStagesOpen}
          companyId={activeCompanyId}
          pipeline={pipeline}
          onChanged={refreshAfterStageChange}
        />
      )}

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
                <DatePicker
                  value={form.expectedCloseDate ?? ""}
                  onChange={(v) => setForm({ ...form, expectedCloseDate: v || null })}
                  clearLabel={t("common.clear")}
                  todayLabel={t("common.today")}
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
