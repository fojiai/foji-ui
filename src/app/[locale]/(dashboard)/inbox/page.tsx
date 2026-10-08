"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import {
  inboxApi, membersApi,
  type InboxConversation, type InboxMessage, type InboxThread, type InboxStatus, type CompanyMember,
  apiErrorMessage,
} from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SkeletonRows } from "@/components/ui/skeleton";
import { PageLoader, LoadingSpinner } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { PageHelp } from "@/components/onboarding/page-help";
import { TourButton } from "@/components/onboarding/tour-button";
import { useTour } from "@/components/onboarding/use-tour";
import { AnvilMark } from "@/components/shared/marks";
import { toast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AudioPlayer } from "@/components/ui/audio-player";
import {
  MessageCircle, Send, ArrowLeft, Clock, Contact2, RefreshCw, Paperclip, FileText, UserCheck,
  CheckCircle2, RotateCcw, Bot, Headset,
} from "lucide-react";

const LIST_POLL_MS = 10_000;
const THREAD_POLL_MS = 6_000;

/** Outbound bodies are stored with the "Name:\n\n" prefix the customer sees.
 *  Strip it for display — the sender is already shown as a label. */
function stripPrefix(body: string, name?: string | null): string {
  if (!name) return body;
  const prefix = `${name}:\n\n`;
  return body.startsWith(prefix) ? body.slice(prefix.length) : body;
}

/** Renders a message body: image, audio, document link, or plain text. */
function MessageContent({ message: m }: { message: InboxMessage }) {
  const caption = stripPrefix(m.body, m.senderDisplayName);
  const type = m.messageType ?? "text";

  if (m.mediaUrl && type === "image") {
    return (
      <span className="block space-y-1">
        {/* Presigned S3 URL — not a configured next/image host, so a plain img. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={m.mediaUrl}
          alt={caption || m.mediaFileName || "image"}
          className="max-h-72 w-auto max-w-full rounded-lg"
          loading="lazy"
        />
        {caption && <span className="block">{caption}</span>}
      </span>
    );
  }

  if (m.mediaUrl && type === "audio") {
    return (
      <span className="block space-y-1">
        <AudioPlayer src={m.mediaUrl} />
        {caption && <span className="block">{caption}</span>}
      </span>
    );
  }

  if (m.mediaUrl) {
    return (
      <span className="block space-y-1">
        <a
          href={m.mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 underline underline-offset-2"
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          {m.mediaFileName || type}
        </a>
        {caption && <span className="block">{caption}</span>}
      </span>
    );
  }

  // Media we could not download — say so rather than showing an empty bubble.
  if (type !== "text") {
    return (
      <span className="inline-flex items-center gap-1.5 italic opacity-80">
        <Paperclip className="h-3.5 w-3.5 shrink-0" />
        {caption || type}
      </span>
    );
  }

  return <>{caption}</>;
}

export default function InboxPage() {
  const t = useTranslations();
  const format = useFormatter();
  const { activeCompanyId } = useAuth();
  const locale = (useParams().locale as string) ?? "pt-br";

  const [conversations, setConversations] = useState<InboxConversation[] | null>(null);
  const tour = useTour("inbox", { ready: conversations !== null });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [thread, setThread] = useState<InboxThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  // Open is the working view. Resolved threads — by a person or by the idle
  // sweep — live in their own tab and come back on their own when the customer
  // writes again.
  const [statusFilter, setStatusFilter] = useState<InboxStatus>("Open");
  const [statusBusy, setStatusBusy] = useState(false);
  const [handlerBusy, setHandlerBusy] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadConversations = useCallback(async () => {
    if (!activeCompanyId) return;
    try {
      setConversations(await inboxApi.conversations(activeCompanyId, undefined, statusFilter));
    } catch {
      setConversations((prev) => prev ?? []);
    }
  }, [activeCompanyId, statusFilter]);

  function changeFilter(next: InboxStatus) {
    if (next === statusFilter) return;
    setStatusFilter(next);
    setConversations(null);
    setSelectedId(null);
    setThread(null);
  }

  const loadThread = useCallback(
    async (id: number, opts?: { silent?: boolean }) => {
      if (!activeCompanyId) return;
      if (!opts?.silent) setThreadLoading(true);
      try {
        setThread(await inboxApi.thread(activeCompanyId, id));
      } catch {
        if (!opts?.silent) toast({ variant: "destructive", title: t("errors.generic") });
      } finally {
        if (!opts?.silent) setThreadLoading(false);
      }
    },
    [activeCompanyId, t]
  );

  // Initial load + poll the conversation list.
  useEffect(() => {
    if (!activeCompanyId) return;
    loadConversations();
    membersApi.list(activeCompanyId).then(setMembers).catch(() => setMembers([]));
    const id = setInterval(loadConversations, LIST_POLL_MS);
    return () => clearInterval(id);
  }, [activeCompanyId, loadConversations]);

  // Poll the open thread so replies from teammates appear without a refresh.
  useEffect(() => {
    if (!selectedId) return;
    const id = setInterval(() => loadThread(selectedId, { silent: true }), THREAD_POLL_MS);
    return () => clearInterval(id);
  }, [selectedId, loadThread]);

  // Opened from the history page ("Reply in Conversations"): /inbox?open=<id>.
  useEffect(() => {
    if (!activeCompanyId) return;
    const id = Number(new URLSearchParams(window.location.search).get("open"));
    if (!id) return;
    setSelectedId(id);
    loadThread(id);
  }, [activeCompanyId, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread?.messages.length]);

  async function openConversation(c: InboxConversation) {
    setSelectedId(c.id);
    setText("");
    await loadThread(c.id);
    if (c.unreadCount > 0 && activeCompanyId) {
      try {
        await inboxApi.markRead(activeCompanyId, c.id);
        setConversations((prev) =>
          prev?.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)) ?? prev
        );
      } catch { /* non-critical */ }
    }
  }

  async function assign(userId: number | null) {
    if (!activeCompanyId || !selectedId) return;
    try {
      const updated = await inboxApi.assign(activeCompanyId, selectedId, userId);
      setThread((prev) => (prev ? { ...prev, conversation: updated } : prev));
      setConversations((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? prev);
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    }
  }

  async function setStatus(next: InboxStatus) {
    if (!activeCompanyId || !selectedId) return;
    setStatusBusy(true);
    try {
      const updated =
        next === "Resolved"
          ? await inboxApi.resolve(activeCompanyId, selectedId)
          : await inboxApi.reopen(activeCompanyId, selectedId);
      setThread((prev) => (prev ? { ...prev, conversation: updated } : prev));
      // It no longer belongs in the tab being viewed.
      setConversations((prev) => prev?.filter((x) => x.id !== updated.id) ?? prev);
      toast({ title: t(next === "Resolved" ? "inbox.resolvedToast" : "inbox.reopenedToast") });
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setStatusBusy(false);
    }
  }

  /** Hybrid: take the conversation from the AI, or hand it back. */
  async function setHandler(takeOver: boolean) {
    if (!activeCompanyId || !selectedId) return;
    setHandlerBusy(true);
    try {
      const updated = takeOver
        ? await inboxApi.takeover(activeCompanyId, selectedId)
        : await inboxApi.release(activeCompanyId, selectedId);
      setThread((prev) => (prev ? { ...prev, conversation: updated } : prev));
      setConversations((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? prev);
      toast({ title: t(takeOver ? "inbox.takenOverToast" : "inbox.handedBackToast") });
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, t("errors.generic")) });
    } finally {
      setHandlerBusy(false);
    }
  }

  async function send() {
    if (!activeCompanyId || !selectedId || !text.trim()) return;
    setSending(true);
    try {
      const sent = await inboxApi.reply(activeCompanyId, selectedId, text.trim());
      setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, sent] } : prev));
      setText("");
      loadConversations();
      // Hybrid: replying took the conversation over — refresh the header state.
      if (thread?.conversation.agentMode === "Hybrid") loadThread(selectedId, { silent: true });
    } catch (err) {
      const msg = (err as { data?: { error?: string } })?.data?.error;
      toast({ variant: "destructive", title: msg || t("errors.generic") });
    } finally {
      setSending(false);
    }
  }

  if (!activeCompanyId) return <PageLoader />;

  const selected = thread?.conversation;
  const windowClosed = selected ? !selected.canReplyFreeform : false;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t("inbox.eyebrow")}
        title={t("inbox.title")}
        description={t("inbox.description")}
        action={
          <div className="flex items-center gap-2">
            <TourButton onClick={tour.start} />
            <Button variant="outline" size="sm" onClick={loadConversations}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> {t("inbox.refresh")}
            </Button>
          </div>
        }
      />
      <PageHelp page="inbox" />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Conversation list — hidden on mobile once a thread is open */}
        <Card className={selectedId ? "hidden lg:block" : ""} data-tour="inbox-list">
          <CardContent className="p-0">
            <div className="border-b p-2" data-tour="inbox-tabs">
              <Tabs value={statusFilter} onValueChange={(v) => changeFilter(v as InboxStatus)}>
                <TabsList className="w-full">
                  <TabsTrigger value="Open" className="flex-1">{t("inbox.tabOpen")}</TabsTrigger>
                  <TabsTrigger value="Resolved" className="flex-1">{t("inbox.tabResolved")}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {conversations === null ? (
              <div className="p-3"><SkeletonRows rows={6} /></div>
            ) : conversations.length === 0 ? (
              /* The list column is only 340px, so the full EmptyState would
                 crowd it — same materials, compact arrangement. */
              <div className="hatch relative flex flex-col items-start gap-2 px-5 py-14">
                <AnvilMark className="h-10 w-10 text-muted-foreground/40" lit={false} />
                <p className="type-display mt-1 text-base">
                  {t(statusFilter === "Open" ? "inbox.emptyOpen" : "inbox.emptyResolved")}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t(statusFilter === "Open" ? "inbox.emptyHint" : "inbox.emptyResolvedHint")}
                </p>
              </div>
            ) : (
              <ul className="max-h-[70vh] divide-y overflow-y-auto">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openConversation(c)}
                      className={`relative flex w-full flex-col items-start gap-1 py-3 pl-5 pr-3 text-left transition-colors hover:bg-accent/50 ${
                        selectedId === c.id ? "bg-accent" : ""
                      }`}
                    >
                      {/* An unanswered conversation is the hottest thing in the
                          app — it is a customer waiting. The stripe reads before
                          any of the text does. */}
                      {c.unreadCount > 0 && (
                        <span
                          className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-spark"
                          aria-hidden="true"
                        />
                      )}
                      <div className="flex w-full items-center gap-2">
                        <span
                          className={`truncate text-sm ${
                            c.unreadCount > 0 ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {c.contactName || c.contactWaId}
                        </span>
                        {c.unreadCount > 0 && (
                          <Badge
                            variant="attention"
                            className="type-readout ml-auto h-5 min-w-5 justify-center px-1.5"
                          >
                            {c.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <span className="line-clamp-1 w-full text-xs text-muted-foreground">
                        {c.lastMessagePreview || t("inbox.mediaPreview")}
                      </span>
                      <span className="flex w-full flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="type-readout">
                          {format.dateTime(new Date(c.lastMessageAt), { dateStyle: "short", timeStyle: "short" })}
                        </span>
                        {c.assignedUserName && (
                          <span className="inline-flex items-center gap-0.5">
                            <UserCheck className="h-3 w-3" /> {c.assignedUserName}
                          </span>
                        )}
                        {/* Read but unanswered: the unread stripe is gone, so
                            this is the only thing saying someone is waiting. */}
                        {c.status === "Open" && c.awaitingReply && c.unreadCount === 0 && (
                          <span className="text-spark-ink">{t("inbox.awaitingReply")}</span>
                        )}
                        {c.status === "Resolved" && (
                          <span className="inline-flex items-center gap-0.5 text-quench-ink">
                            <CheckCircle2 className="h-3 w-3" />
                            {t(c.resolvedAutomatically ? "inbox.resolvedAuto" : "inbox.resolvedManual")}
                          </span>
                        )}
                        {/* Hybrid: who has it right now. A customer who asked for
                            a person is the one thing here that needs someone. */}
                        {c.agentMode === "Hybrid" && c.status === "Open" && (
                          c.awaitingHumanSince ? (
                            /* How long they've waited is the whole point — it's
                               what tells you which one to open first. */
                            <span className="inline-flex items-center gap-0.5 text-spark-ink">
                              <Headset className="h-3 w-3" />
                              {t("inbox.askedForPerson")} ·{" "}
                              <span className="type-readout">
                                {format.relativeTime(new Date(c.awaitingHumanSince))}
                              </span>
                            </span>
                          ) : c.humanTakeover ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Headset className="h-3 w-3" /> {t("inbox.withTeam")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-forge-ink">
                              <Bot className="h-3 w-3" /> {t("inbox.aiAnswering")}
                            </span>
                          )
                        )}
                        {c.status === "Open" && !c.canReplyFreeform && (
                          <span className="inline-flex items-center gap-0.5 text-spark-ink">
                            <Clock className="h-3 w-3" /> {t("inbox.windowClosedShort")}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Thread */}
        <Card className={!selectedId ? "hidden lg:block" : ""}>
          <CardContent className="flex h-[70vh] flex-col p-0">
            {!selectedId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <MessageCircle className="h-9 w-9 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{t("inbox.selectConversation")}</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="flex items-center gap-2 border-b px-3 py-2.5">
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 lg:hidden"
                    onClick={() => { setSelectedId(null); setThread(null); }}
                    aria-label={t("inbox.back")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {selected?.contactName || selected?.contactWaId}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {selected?.contactWaId} · {selected?.agentName}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Select
                      value={selected?.assignedUserId ? String(selected.assignedUserId) : "none"}
                      onValueChange={(v) => assign(v === "none" ? null : Number(v))}
                    >
                      <SelectTrigger className="h-8 w-[170px]">
                        <UserCheck className="mr-1 h-3.5 w-3.5 shrink-0" />
                        <SelectValue placeholder={t("inbox.unassigned")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("inbox.unassigned")}</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.userId} value={String(m.userId)}>
                            {m.firstName} {m.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selected?.agentMode === "Hybrid" && selected.status === "Open" && (
                      selected.humanTakeover ? (
                        <Button
                          variant="outline" size="sm" disabled={handlerBusy}
                          onClick={() => setHandler(false)}
                        >
                          {handlerBusy
                            ? <LoadingSpinner size="sm" className="mr-1" />
                            : <Bot className="mr-1 h-3.5 w-3.5" />}
                          {t("inbox.handBack")}
                        </Button>
                      ) : (
                        <Button size="sm" disabled={handlerBusy} onClick={() => setHandler(true)}>
                          {handlerBusy
                            ? <LoadingSpinner size="sm" className="mr-1" />
                            : <Headset className="mr-1 h-3.5 w-3.5" />}
                          {t("inbox.takeOver")}
                        </Button>
                      )
                    )}
                    {selected?.status === "Resolved" ? (
                      <Button
                        variant="outline" size="sm" disabled={statusBusy}
                        onClick={() => setStatus("Open")}
                      >
                        {statusBusy
                          ? <LoadingSpinner size="sm" className="mr-1" />
                          : <RotateCcw className="mr-1 h-3.5 w-3.5" />}
                        {t("inbox.reopen")}
                      </Button>
                    ) : (
                      <Button
                        variant="outline" size="sm" disabled={statusBusy || !selected}
                        onClick={() => setStatus("Resolved")}
                      >
                        {statusBusy
                          ? <LoadingSpinner size="sm" className="mr-1" />
                          : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                        {t("inbox.resolve")}
                      </Button>
                    )}
                  </div>
                  {selected?.contactId && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/${locale}/crm/contacts/${selected.contactId}`}>
                        <Contact2 className="mr-1 h-3.5 w-3.5" /> {t("inbox.openContact")}
                      </Link>
                    </Button>
                  )}
                </div>

                {/* The AI handed this over: say why, so whoever opens it knows a
                    customer is waiting on a person specifically. */}
                {selected?.agentMode === "Hybrid" && selected.status === "Open" && selected.awaitingHumanSince && (
                  <div className="flex items-start gap-2 border-b border-spark/40 bg-spark/10 px-3 py-2 text-xs text-spark-ink">
                    <Headset className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {/* Two states of the same request: still waiting (the AI
                          is quiet), or nobody came in time (the AI told the
                          customer and resumed). */}
                      {t(selected.humanTakeover ? "inbox.escalatedBanner" : "inbox.escalationTimedOutBanner")}
                    </span>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
                  {threadLoading ? (
                    <SkeletonRows rows={5} />
                  ) : (
                    (thread?.messages ?? []).map((m: InboxMessage) => {
                      const outbound = m.direction === "Outbound";
                      return (
                        <div key={m.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] sm:max-w-[70%] ${outbound ? "text-right" : ""}`}>
                            {outbound && (m.isAiGenerated || m.senderDisplayName) && (
                              <p className="mb-0.5 text-[10px] font-medium text-muted-foreground">
                                {m.isAiGenerated ? (
                                  <>
                                    <Bot className="mr-0.5 inline h-3 w-3 align-[-2px]" />
                                    {t("inbox.aiLabel")}
                                  </>
                                ) : (
                                  m.senderDisplayName
                                )}
                              </p>
                            )}
                            <div
                              className={`inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                                outbound
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "bg-muted rounded-bl-sm"
                              }`}
                            >
                              <MessageContent message={m} />
                            </div>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {format.dateTime(new Date(m.createdAt), { timeStyle: "short" })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Reply */}
                <div className="border-t p-3">
                  {windowClosed ? (
                    <div className="flex items-start gap-2 rounded-md border border-spark/40 bg-spark/10 p-3 text-xs text-spark-ink">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{t("inbox.windowClosed")}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
                        }}
                        placeholder={t("inbox.replyPlaceholder")}
                        className="min-h-[64px] resize-none"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] text-muted-foreground">
                          {/* Hybrid: sending takes the conversation over — say so
                              before it happens, not after. */}
                          {selected?.agentMode === "Hybrid" && !selected.humanTakeover
                            ? t("inbox.replyTakesOverHint")
                            : t("inbox.prefixHint")}
                        </p>
                        <Button size="sm" onClick={send} disabled={sending || !text.trim()}>
                          {sending ? <LoadingSpinner size="sm" className="mr-2" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                          {t("inbox.send")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
