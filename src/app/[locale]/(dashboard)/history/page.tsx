"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";
import {
  agentsApi, historyApi,
  type Agent, type HistoryChannel, type HistoryItem, type HistoryMessage, type HistoryThread,
  apiErrorMessage,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonRows } from "@/components/ui/skeleton";
import { AudioPlayer } from "@/components/ui/audio-player";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PageHeader } from "@/components/shared/page-header";
import { PageHelp } from "@/components/onboarding/page-help";
import { AnvilMark } from "@/components/shared/marks";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Bot, FileText, Globe, Headset, History, MessageCircle, RefreshCw, Search,
} from "lucide-react";

const PAGE_SIZE = 30;

/** Team replies on WhatsApp are stored with the "Name:\n\n" prefix the customer saw. */
function stripPrefix(text: string, name?: string | null): string {
  if (!name) return text;
  const prefix = `${name}:\n\n`;
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

function MessageBody({ m, fileLabel }: { m: HistoryMessage; fileLabel: string }) {
  const text = stripPrefix(m.text ?? "", m.senderName);
  const type = m.mediaContentType ?? "";
  if (m.mediaUrl && type.startsWith("image/")) {
    return (
      <span className="block space-y-1">
        {/* Presigned S3 URL, not a configured next/image host. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.mediaUrl} alt={text || m.mediaFileName || fileLabel} className="max-h-72 w-auto max-w-full rounded-lg" loading="lazy" />
        {text && <span className="block">{text}</span>}
      </span>
    );
  }
  if (m.mediaUrl && type.startsWith("audio/")) {
    return (
      <span className="block space-y-1">
        <AudioPlayer src={m.mediaUrl} />
        {text && <span className="block">{text}</span>}
      </span>
    );
  }
  if (m.mediaUrl) {
    return (
      <span className="block space-y-1">
        <a href={m.mediaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 underline underline-offset-2">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          {m.mediaFileName || fileLabel}
        </a>
        {text && <span className="block">{text}</span>}
      </span>
    );
  }
  return <>{text}</>;
}

const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

export default function HistoryPage() {
  const t = useTranslations("history");
  const tAll = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const locale = (useParams().locale as string) ?? "pt-br";
  const { user, activeCompanyId } = useAuth();

  const role = user?.companies?.find((c) => c.companyId === activeCompanyId)?.role;
  const allowed = !!user && (user.isSuperAdmin || role === "owner" || role === "admin");

  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState("all");
  const [channel, setChannel] = useState<"all" | HistoryChannel>("all");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");

  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [thread, setThread] = useState<HistoryThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const threadTop = useRef<HTMLDivElement | null>(null);

  // Members (the "user" role) don't get the full history: send them to the inbox.
  useEffect(() => {
    if (user && activeCompanyId && !allowed) router.replace(`/${locale}/inbox`);
  }, [user, activeCompanyId, allowed, router, locale]);

  // Search as you type, after a short pause.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchText.trim()), 350);
    return () => clearTimeout(id);
  }, [searchText]);

  useEffect(() => {
    if (!activeCompanyId || !allowed) return;
    agentsApi.list(activeCompanyId).then(setAgents).catch(() => setAgents([]));
  }, [activeCompanyId, allowed]);

  const load = useCallback(
    async (nextPage: number) => {
      if (!activeCompanyId || !allowed) return;
      try {
        const res = await historyApi.list(activeCompanyId, {
          agentId: agentId === "all" ? undefined : Number(agentId),
          channel: channel === "all" ? undefined : channel,
          search: search || undefined,
          page: nextPage,
          pageSize: PAGE_SIZE,
        });
        setItems((prev) => (nextPage === 1 ? res.items : [...(prev ?? []), ...res.items]));
        setTotal(res.total);
        setPage(nextPage);
      } catch (err) {
        toast({ variant: "destructive", title: apiErrorMessage(err, tAll("errors.generic")) });
        setItems((prev) => prev ?? []);
      }
    },
    [activeCompanyId, allowed, agentId, channel, search, tAll]
  );

  useEffect(() => {
    setItems(null);
    void load(1);
  }, [load]);

  async function loadMore() {
    setLoadingMore(true);
    await load(page + 1);
    setLoadingMore(false);
  }

  async function open(item: HistoryItem) {
    if (!activeCompanyId) return;
    setSelected(item);
    setThread(null);
    setThreadLoading(true);
    try {
      setThread(await historyApi.get(activeCompanyId, item.kind, item.id));
    } catch (err) {
      toast({ variant: "destructive", title: apiErrorMessage(err, tAll("errors.generic")) });
    } finally {
      setThreadLoading(false);
      threadTop.current?.scrollIntoView({ block: "nearest" });
    }
  }

  const who = (item: HistoryItem) =>
    item.contactName || item.contactPhone || item.contactEmail || (item.channel === "site" ? t("visitor") : t("customer"));
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short" });

  if (!allowed) return null;

  const filtered = agentId !== "all" || channel !== "all" || !!search;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        action={
          <span className="type-readout text-sm text-muted-foreground">
            {t("count", { count: total })}
          </span>
        }
      />
      <PageHelp page="history" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("search")}
            aria-label={t("searchLabel")}
            className="pl-9"
          />
        </div>
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger className="w-full sm:w-[220px]" aria-label={t("agentFilter")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allAgents")}</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={(v) => setChannel(v as "all" | HistoryChannel)}>
          <SelectTrigger className="w-full sm:w-[200px]" aria-label={t("channelFilter")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allChannels")}</SelectItem>
            <SelectItem value="site">{t("site")}</SelectItem>
            <SelectItem value="whatsapp">{t("whatsapp")}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => { setItems(null); void load(1); }}>
          <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" />
          {t("refresh")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* The list, hidden on phones once a conversation is open. */}
        <Card className={selected ? "hidden lg:block" : ""}>
          <CardContent className="p-0">
            {items === null ? (
              <div className="p-3"><SkeletonRows rows={6} /></div>
            ) : items.length === 0 ? (
              <div className="hatch relative flex flex-col items-start gap-2 px-5 py-14">
                <AnvilMark className="h-10 w-10 text-muted-foreground/40" lit={false} />
                <p className="type-display mt-1 text-base">{filtered ? t("noResults") : t("empty")}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {filtered ? t("noResultsHint") : t("emptyHint")}
                </p>
              </div>
            ) : (
              <>
                <ul className="max-h-[70vh] divide-y overflow-y-auto">
                  {items.map((item) => {
                    const active = selected?.kind === item.kind && selected.id === item.id;
                    return (
                      <li key={`${item.kind}-${item.id}`}>
                        <button
                          type="button"
                          onClick={() => open(item)}
                          aria-current={active ? "true" : undefined}
                          className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-accent/50 ${active ? "bg-accent" : ""}`}
                        >
                          <div className="flex w-full items-center gap-2">
                            {item.channel === "whatsapp" ? (
                              <MessageCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t("whatsapp")} />
                            ) : (
                              <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t("site")} />
                            )}
                            <span className="truncate text-sm font-medium">{who(item)}</span>
                            <span className="type-readout ml-auto shrink-0 text-[11px] text-muted-foreground">
                              {when(item.lastMessageAt)}
                            </span>
                          </div>
                          {item.preview && (
                            <p className="line-clamp-2 text-xs text-muted-foreground">{item.preview}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              <Bot className="mr-1 h-3 w-3" aria-hidden="true" />
                              {item.agentName}
                            </Badge>
                            {item.teamReplied && (
                              <Badge variant="secondary" className="text-[10px]">
                                <Headset className="mr-1 h-3 w-3" aria-hidden="true" />
                                {t("teamReplied")}
                              </Badge>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {items.length < total && (
                  <div className="border-t p-2">
                    <Button variant="ghost" className="w-full" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore && <LoadingSpinner size="sm" className="mr-2" />}
                      {t("loadMore")}
                    </Button>
                  </div>
                )}
              </>
            )}
            <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">{t("retention")}</p>
          </CardContent>
        </Card>

        {/* The conversation, read only. */}
        <Card className={!selected ? "hidden lg:block" : ""}>
          <CardContent className="flex min-h-[60vh] flex-col p-0">
            <div ref={threadTop} />
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
                <History className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
                <p className="max-w-xs text-sm text-muted-foreground">{t("pick")}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 border-b p-3">
                  <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSelected(null)}>
                    <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                    {t("back")}
                  </Button>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{who(selected)}</p>
                    <p className="text-xs text-muted-foreground">
                      {[selected.contactPhone, selected.contactEmail].filter(Boolean).join(" · ")}
                      {(selected.contactPhone || selected.contactEmail) && " · "}
                      {t("started", { date: when(selected.startedAt) })}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Badge variant="outline">
                      <Bot className="mr-1 h-3 w-3" aria-hidden="true" />
                      {selected.agentName}
                    </Badge>
                    {selected.kind === "inbox" && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/${locale}/inbox?open=${selected.id}`}>{t("openInbox")}</Link>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="max-h-[70vh] flex-1 space-y-3 overflow-y-auto px-3 py-4">
                  {threadLoading ? (
                    <SkeletonRows rows={5} />
                  ) : !thread || thread.messages.length === 0 ? (
                    <p className="p-6 text-center text-sm text-muted-foreground">{t("noMessages")}</p>
                  ) : (
                    thread.messages.map((m, i) => {
                      const ours = m.from !== "customer";
                      const newDay = i === 0 || !sameDay(thread.messages[i - 1].at, m.at);
                      const label =
                        m.from === "customer"
                          ? who(selected)
                          : m.from === "team"
                            ? m.senderName || t("team")
                            : selected.agentName;
                      return (
                        <div key={i}>
                          {newDay && (
                            <p className="type-readout my-2 text-center text-[11px] text-muted-foreground">
                              {format.dateTime(new Date(m.at), { dateStyle: "long" })}
                            </p>
                          )}
                          <div className={`flex ${ours ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] sm:max-w-[70%] ${ours ? "text-right" : ""}`}>
                              <p className="mb-0.5 text-[10px] font-medium text-muted-foreground">
                                {m.from === "ai" && <Bot className="mr-0.5 inline h-3 w-3 align-[-2px]" aria-hidden="true" />}
                                {m.from === "team" && <Headset className="mr-0.5 inline h-3 w-3 align-[-2px]" aria-hidden="true" />}
                                {label}
                              </p>
                              <div
                                className={`inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-left text-sm ${
                                  m.from === "ai"
                                    ? "rounded-br-sm bg-primary text-primary-foreground"
                                    : m.from === "team"
                                      ? "rounded-br-sm border-2 border-primary/40 bg-card"
                                      : "rounded-bl-sm bg-muted"
                                }`}
                              >
                                <MessageBody m={m} fileLabel={t("attachment")} />
                              </div>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {format.dateTime(new Date(m.at), { timeStyle: "short" })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
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
