"use client";

/**
 * Design system gallery — every visual decision on one page, with real content.
 *
 * Open at /pt-br/design-preview. No login required (see PUBLIC_PATHS in
 * middleware.ts). Delete this folder + that middleware entry to remove it.
 */

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import {
  Bot, BarChart3, Zap, ArrowRight, Plus, Briefcase, Globe, Pencil,
  MessageSquare, Sun, Moon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { HeatDot, HeatStatus } from "@/components/shared/heat";
import { AnvilMark } from "@/components/shared/marks";
import { cn } from "@/lib/utils";

const AGENTS = [
  { id: 1, name: "Atendimento Loja", desc: "Responde dúvidas sobre pedidos e entregas", active: true, files: 12, wa: true },
  { id: 2, name: "Financeiro", desc: "Simples Nacional, DAS e notas fiscais", active: true, files: 7, wa: true },
  { id: 3, name: "RH Interno", desc: "Férias, benefícios e políticas internas", active: false, files: 3, wa: false },
];

const CONVERSAS = [
  { n: "Ana Souza", m: "Qual o prazo de entrega para Fortaleza?", u: 3, t: "14:22" },
  { n: "Carlos Lima", m: "Consigo parcelar em 3x sem juros?", u: 0, t: "13:08" },
  { n: "Beatriz Rocha", m: "Vocês emitem nota fiscal para MEI?", u: 1, t: "11:47" },
  { n: "Diego Farias", m: "Obrigado, resolvido!", u: 0, t: "09:15" },
];

function Section({ n, title, note, children }: { n: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3 border-b border-border pb-3">
        <span className="type-label text-primary">{n}</span>
        <h2 className="type-display text-xl">{title}</h2>
        <p className="ml-auto hidden max-w-md text-right text-xs text-muted-foreground sm:block">{note}</p>
      </div>
      {children}
    </section>
  );
}

function Readout({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-3.5 px-6 py-5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="type-label truncate text-muted-foreground">{label}</p>
        <p className="type-readout mt-1.5 text-xl text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Swatch({ token, name, role }: { token: string; name: string; role: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("h-11 w-11 shrink-0 rounded-lg border border-border", token)} />
      <div className="min-w-0">
        <p className="type-label text-foreground">{name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{role}</p>
      </div>
    </div>
  );
}

export default function DesignPreview() {
  /* This page is the theme switcher, so it drives next-themes directly rather
     than toggling the class itself — setting the class by hand just loses a
     race with the provider on every render. */
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  return (
    <div className="min-h-screen bg-muted">
      {/* Review toolbar */}
      <div className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
          <span className="type-display text-base">Foji AI — Sistema visual</span>
          <span className="type-label hidden text-muted-foreground sm:inline">
            {dark ? "Modo escuro" : "Modo claro"}
          </span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setTheme(dark ? "light" : "dark")}>
            {dark ? <Sun className="mr-1 h-4 w-4" /> : <Moon className="mr-1 h-4 w-4" />}
            {dark ? "Ver modo claro" : "Ver modo escuro"}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-12 px-6 py-10">
        {/* ── 01 Dashboard ── */}
        <Section n="01" title="Painel — primeira impressão" note="A bigorna: responde “meu agente está no ar e o que ele fez?” antes de qualquer detalhe.">
          <div className="space-y-8">
            <div className="anvil relative overflow-hidden rounded-2xl border border-iron-border">
              <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12">
                <div className="min-w-0">
                  <p className="type-label flex items-center gap-2 text-iron-muted">
                    <span className="h-px w-5 bg-forge" />
                    Forje sua inteligência
                  </p>
                  <h1 className="type-display mt-3 text-[2rem] text-iron-foreground sm:text-[2.4rem]">
                    Bem-vindo, Mateus
                  </h1>
                  <p className="mt-3 flex items-center gap-2 text-sm text-iron-muted">
                    <HeatDot level="live" />2 de 3 agentes no ar
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button variant="iron" asChild>
                      <Link href="#">Ver agentes <ArrowRight className="ml-1 h-4 w-4" /></Link>
                    </Button>
                    <Button variant="iron" asChild><Link href="#">Caixa de entrada</Link></Button>
                  </div>
                </div>
                <div className="lg:w-[15rem] lg:border-l lg:border-iron-border lg:pl-8">
                  <p className="type-label text-iron-muted">Total de conversas</p>
                  <p className="type-readout mt-2 text-[3.25rem] leading-none text-iron-foreground">1.482</p>
                  <p className="mt-2 text-xs text-iron-muted">Últimos 30 dias</p>
                </div>
              </div>
            </div>

            <div className="plate grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
              {[
                { label: "Total de agentes", value: 3, icon: Bot },
                { label: "Agentes ativos", value: 2, icon: Zap },
                { label: "Total de mensagens", value: "9.310", icon: BarChart3 },
              ].map((r) => (
                <div key={r.label} className="bg-card"><Readout {...r} /></div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── 02 Agents ── */}
        <Section n="02" title="Agentes" note="O calor marca só o que está no ar. Um agente parado é ferro frio — sem lavagem de cor no card.">
          <div className="space-y-5">
            <PageHeader
              eyebrow="Seus agentes"
              title="Agentes"
              description="2 de 3 no ar agora"
              action={<Button><Plus className="mr-1 h-4 w-4" /> Criar agente</Button>}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {AGENTS.map((a) => (
                <Link key={a.id} href="#" className="group block">
                  <Card className="plate-interactive relative h-full overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                            a.active ? "border-forge/25 bg-forge/10 text-forge-ink" : "border-border bg-muted text-muted-foreground")}>
                            <Briefcase className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base">{a.name}</CardTitle>
                            <CardDescription className="mt-0.5 line-clamp-1">{a.desc}</CardDescription>
                          </div>
                        </div>
                        <HeatStatus level={a.active ? "live" : "idle"} label={a.active ? "Ativo" : "Inativo"} className="shrink-0 pt-1" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="gap-1"><Globe className="h-3 w-3" />Português</Badge>
                        {a.wa && <Badge variant="secondary" className="gap-1"><MessageSquare className="h-3 w-3" />WhatsApp</Badge>}
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-3">
                        <span className="type-readout text-xs text-muted-foreground">
                          {a.files} <span className="font-sans">arquivos</span>
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                          <Pencil className="h-3 w-3" /> Editar
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </Section>

        {/* ── 03 Inbox ── */}
        <Section n="03" title="Caixa de entrada" note="Conversa sem resposta é a coisa mais quente do app: a faixa âmbar aparece antes de você ler o nome.">
          <div className="plate max-w-md overflow-hidden rounded-xl border bg-card">
            <ul className="divide-y divide-border">
              {CONVERSAS.map((c) => (
                <li key={c.n}>
                  <button type="button" className="relative flex w-full flex-col items-start gap-1 py-3 pl-5 pr-3 text-left transition-colors hover:bg-accent/50">
                    {c.u > 0 && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-spark" aria-hidden="true" />}
                    <div className="flex w-full items-center gap-2">
                      <span className={cn("truncate text-sm", c.u > 0 ? "font-semibold" : "font-medium")}>{c.n}</span>
                      {c.u > 0 && (
                        <Badge variant="attention" className="type-readout ml-auto h-5 min-w-5 justify-center px-1.5">{c.u}</Badge>
                      )}
                    </div>
                    <span className="line-clamp-1 w-full text-xs text-muted-foreground">{c.m}</span>
                    <span className="type-readout text-[10px] text-muted-foreground">15/08/26 {c.t}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* ── 04 Empty states ── */}
        <Section n="04" title="Estados vazios" note="Sem ícone-em-círculo centralizado. A régua no topo diz o tom: nada / atenção / bloqueado.">
          <div className="space-y-4">
            <EmptyState
              eyebrow="Comece aqui"
              title="Nenhum agente ainda"
              description="Crie seu primeiro agente, envie seus documentos e ele começa a responder seus clientes no WhatsApp."
              action={<Button><Plus className="mr-1 h-4 w-4" /> Criar agente</Button>}
              secondaryAction={<Button variant="outline">Ver como funciona</Button>}
            />
            <EmptyState
              tone="warn"
              eyebrow="Plano"
              title="Nenhum plano ativo"
              description="Assine um plano para desbloquear todos os recursos."
              action={<Button>Escolher um plano</Button>}
            />
            <EmptyState
              tone="stop"
              eyebrow="Plano"
              title="Seu período de teste acabou"
              description="Assine um plano para continuar usando o Foji AI."
              action={<Button>Escolher um plano</Button>}
            />
          </div>
        </Section>

        {/* ── 05 Type ── */}
        <Section n="05" title="Tipografia" note="Archivo (títulos) + Instrument Sans (texto) + IBM Plex Mono (números). Geist saiu.">
          <div className="plate space-y-6 rounded-xl border bg-card p-8">
            <div>
              <p className="type-label text-muted-foreground">Display — Archivo</p>
              <p className="type-display mt-2 text-4xl">Forje sua inteligência</p>
            </div>
            <div>
              <p className="type-label text-muted-foreground">Texto — Instrument Sans</p>
              <p className="mt-2 max-w-2xl leading-relaxed">
                Treine um agente com seus documentos e deixe ele responder as dúvidas dos seus
                clientes automaticamente — no WhatsApp e no seu site. Sem código, em minutos.
              </p>
            </div>
            <div>
              <p className="type-label text-muted-foreground">Números — IBM Plex Mono</p>
              <p className="type-readout mt-2 text-3xl">1.482 · 9.310 · R$ 149,90 · 15/08/26</p>
            </div>
          </div>
        </Section>

        {/* ── 06 Color ── */}
        <Section n="06" title="Cor = estado" note="Fogo só para o que está vivo, quente ou esperando você. O resto é ferro e aço.">
          <div className="plate grid gap-6 rounded-xl border bg-card p-8 sm:grid-cols-2 lg:grid-cols-3">
            <Swatch token="bg-primary" name="Ember" role="Ação principal e identidade" />
            <Swatch token="bg-forge" name="Forge" role="No ar / rodando agora" />
            <Swatch token="bg-spark" name="Spark" role="Esperando você — não lido" />
            <Swatch token="bg-quench" name="Quench" role="Resolvido / saudável" />
            <Swatch token="bg-iron" name="Iron" role="A bigorna — faixa do painel" />
            <Swatch token="bg-muted" name="Steel" role="A bancada — fundo" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["default", "secondary", "outline", "live", "attention", "success", "idle", "destructive"] as const).map((v) => (
              <Badge key={v} variant={v}>{v}</Badge>
            ))}
          </div>
        </Section>

        {/* ── 07 Mark ── */}
        <Section n="07" title="A marca da bigorna" note="Desenhada, não emprestada de uma biblioteca de ícones. Com faíscas = convite; sem = aviso.">
          <div className="plate flex flex-wrap items-end gap-12 rounded-xl border bg-card p-8 text-muted-foreground">
            <AnvilMark className="h-24 w-24" />
            <AnvilMark className="h-16 w-16" />
            <AnvilMark className="h-16 w-16" lit={false} />
            <AnvilMark className="h-10 w-10" />
          </div>
        </Section>

        <p className="border-t border-border pt-6 text-xs text-muted-foreground">
          Página de revisão — apagar <code>src/app/[locale]/design-preview</code> e a entrada
          <code> /design-preview</code> em <code>src/middleware.ts</code> quando não precisar mais.
        </p>
      </div>
    </div>
  );
}
