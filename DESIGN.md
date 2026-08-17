# Foji AI — Design System

**Concept: the anvil, not the flame.**

The brand is a phoenix rising from an anvil — *Forje sua inteligência*. Every "fire brand"
reaches for the same gradient glow, and the marketing site already spends its budget there.
The app can't: an SMB owner opens this every morning to answer customers, not to be impressed.

So we invert it. In a real forge the anvil is dark, heavy and cold; the heat is the *work* —
applied to a small area, briefly, and it means something. That gives us an information-design
rule, not a decoration:

> **Heat is state.** The fire palette is reserved for what is live, hot, or waiting on you.
> Everything else is iron and steel.

An agent that's running glows. An idle one is cold. A conversation awaiting reply runs hot;
a resolved one quenches to teal. The owner should be able to squint at the screen and see
what needs them — the colour *is* the signal, so it can never be spent on ornament.

---

## Color

Named tokens; all defined in `src/app/globals.css`, all exposed as Tailwind utilities.

| Token | Light | Role |
|---|---|---|
| **Steel** `#F3F0ED` | `--background` | The workbench. Warm-biased grey, low chroma — chosen, not defaulted. Deeper than the old off-white so white plates actually lift off it. |
| **Plate** `#FFFFFF` | `--card` | Content surfaces. Lit from above (see Depth). |
| **Iron** `#16120F` | `--iron` | The anvil. A deliberately dark slab used *in both themes* — the dashboard band, and nowhere else. |
| **Ember** `#FF2D2D` | `--primary` | Brand red. Primary actions and identity only. |
| **Forge** `#FF5A1F` | `--forge` | The mid-heat. Live/hot state, heat gradients, chart series 2. |
| **Spark** `#FFB300` | `--spark` | The highest heat. Attention that hasn't been handled — unread, unassigned, expiring. |
| **Quench** `#12897A` | `--quench` | Cooled metal. Resolved, done, healthy. Our success hue — a teal-green, not a stock emerald. |
| **Slag** `#7D736C` | `--muted-foreground` | Warm grey secondary text. |

**On red-vs-red.** The brand primary is red and so is "destructive" — the previous tokens were
almost the same colour (`oklch 0.59 0.25 27` vs `0.577 0.245 27`). Since the brand red is fixed,
destructive moves to a deeper, cooler crimson (`oklch 0.505 0.196 16`), never appears as a fill
outside a confirm dialog, and always carries an icon. Form, not just hue, separates them.

**Semantic colors are separate from the accent.** Quench / Spark / destructive-crimson carry
meaning. Ember carries identity. They never stand in for each other.

## Type

Geist is gone — it's the default every Next.js app ships with, and it says nothing.

- **Display — Archivo** (Omnibus-Type, Buenos Aires). A grotesque drawn for signage and highway
  lettering. At weight 700 with the width axis pushed to ~108 it reads *stamped* — struck into
  metal — which is exactly the anvil. A Latin-American foundry for a Brazilian product is a
  quiet bonus. Used for page titles, card titles, big numerals. Never for body.
- **Body — Instrument Sans.** Contemporary, faintly warm, narrower than Inter so tables hold more
  columns, and it stays crisp at 14–15px. Excellent diacritics for pt-BR/es (ã õ ç ñ).
- **Utility — IBM Plex Mono.** Metrics, timestamps, IDs, and uppercase micro-labels. It makes
  numbers read as *instrument readings* — a gauge on the forge — and gives us honest
  `tabular-nums` everywhere digits stack.

Root stays at 17px: the audience is business owners, not developers, and generous body text is
part of the accessibility story. Micro-labels get `0.08em` tracking; headings get
`text-wrap: balance`.

## Layout & depth

**The workbench.** A fixed iron sidebar on the left, a warm steel workspace, content laid on
white plates. Light comes from above: every plate carries a 1px top highlight and a soft
grounded shadow (`--shadow-plate`), so depth comes from *lighting a material* rather than from
the generic drop shadow on a rounded card. On hover a plate lifts 2px and its edge warms toward
ember.

**The dashboard opens with the anvil.** The old first impression was four identical stat cards —
no hierarchy, nothing answered. It's replaced by a single dark iron band that answers the
owner's actual first question: *is my agent working, and what did it do?* Live agent count as a
heat readout, the period's conversations as a large mono numeral, an ember sparkline, and the
greeting. Summary before detail; the stats drop to a compact readout row beneath it.

**Empty states stop being centered-circle-icon.** That layout (round tinted icon, centered text,
one button) is the house style of every generated dashboard. Ours are left-aligned and
asymmetric, with a bespoke anvil-and-spark mark on a hatched panel, a display-face title, one
plain-spoken line, and a primary action beside a quiet secondary. They describe the shape of
what will be there rather than apologising for absence.

## What the research changed

A second pass audited the design against current dashboard UX research rather than
taste. Three findings drove real edits:

**Working memory holds 5–7 chunks; overview dashboards want 4–5 metrics with generous
whitespace.** The dashboard was showing the anvil band plus four readouts plus a chart,
and the readout strip repeated *total de conversas* — the band's own hero number. That's
the dashboard saying the same thing twice before the owner has finished reading it once.
Now three readouts, none duplicating the band.

**"Redundant visual encodings and decorative elements" are an explicit anti-pattern.**
The agent card was encoding one bit — *is this live?* — four separate times: background
wash, border tint, icon tint, and the status dot. Beyond being noise, it spent the fire
palette on every card at once, which is exactly what the heat rule exists to prevent. Now
the dot and its label carry the state and the icon tint quietly reinforces it; the plate
stays neutral. Same cut on the empty states (the tinted wash went, hatching and mark
stayed) and in the band (a heat gauge that restated the sentence beside it in bars).

**Restraint reads as premium; crowding is the amateur tell.** Premium interfaces are
near-greyscale with one deliberate accent used sparingly. Cuts: the industry badge on
agent cards (the card's icon already says it), wider spacing between sections, a larger
radius, and more air inside plates.

One counter-move: cutting the wash left `warn` and `stop` empty states nearly
indistinguishable from `invite`, and a warning that doesn't read is a functional failure,
not a clean design. Tone now rides on a 3px rule along the top edge — one structural
stroke, unmissable, and completely absent when there's nothing to warn about.

**Navigation was the other real finding.** Thirteen flat sidebar items forces a full read
every time, and IA should mirror the user's mental model rather than the codebase. The nav
is now grouped by what the owner is trying to do — Painel, then *Atendimento* / *Clientes*
/ *Conta* — each group inside the 5–7 budget.

Sources: [cognitive load & IA](https://www.sanjaydey.com/saas-dashboard-design-information-architecture-cognitive-overload/) ·
[2026 SaaS UI trends](https://www.saasui.design/blog/7-saas-ui-design-trends-2026) ·
[the Linear/Vercel/Raycast aesthetic](https://studiomaydit.com/blog/linear-vercel-raycast-aesthetic) ·
[how Stripe, Linear and Vercel ship premium UI](https://mantlr.com/blog/stripe-linear-vercel-premium-ui)

## Rules that keep it coherent

1. Fire palette only for live/hot/attention state. If it's decoration, it's iron.
2. One bold thing per screen (the dashboard band; the agent grid's heat). Everything around it quiet.
3. **Encode each fact once.** Before adding a wash, a border tint or a badge, check whether
   something on that element already says the same thing. If it does, the new device is noise.
4. **Five to seven elements per view.** Anything past that is a second view or a drill-down.
5. Numbers in mono with `tabular-nums`. Labels in mono uppercase. Prose in Instrument Sans.
6. Every token is defined in both themes at the `:root` / `.dark` level — never a colour whose
   only definition sits inside a `dark:` variant.
7. Motion is small and collapses entirely under `prefers-reduced-motion`.
