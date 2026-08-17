# foji-ui — Claude Development Rules

These rules apply to every file in this repository. Follow them strictly.

---

## UI Components

- **Always use shadcn/ui components** — never raw HTML elements for UI chrome (buttons, inputs, dialogs, selects, checkboxes, badges, cards, dropdowns)
- **Never use native browser `alert()`, `confirm()`, or `prompt()`** — use shadcn `AlertDialog` for confirmations and `Dialog` for modals
- **Never use an unstyled native `<select>`** — always use shadcn `Select`
- **Never use native `<input type="checkbox">`** — always use shadcn `Checkbox`
- **Destructive actions** always require a shadcn `AlertDialog` with an explicit confirm step before execution

## Loading States

- Use `<LoadingSpinner />` from `components/ui/loading-spinner.tsx` on **every** page load and async data fetch
- Sizes: `sm` (inline), `md` (section), `lg` (card), `xl` (full page)
- Never leave a blank/white screen while data is loading
- Form submit buttons must show a spinner and be disabled while submitting

## Colors

Read `DESIGN.md` before changing anything visual. The short version:

- **Heat is state.** The fire palette (`ember` / `forge` / `spark`) marks what is live,
  hot, or waiting on the user. Never use it as decoration — if it's ornament, it's iron.
- **Never hardcode hex values** (`#FF2D2D`, etc.) in component files
- All tokens live in `src/app/globals.css` (Tailwind v4 — there is **no** `tailwind.config.ts`).
  Add new colors to the `@theme inline` block so they become Tailwind utilities.
- Semantic tokens, all available as `bg-*` / `text-*` / `border-*`:
  - `primary` — brand ember, primary actions and identity
  - `forge` — live / running · `spark` — needs attention · `quench` — resolved / healthy
  - `iron` (+ `iron-foreground`, `iron-muted`, `iron-border`) — the dark anvil band
- **`*-ink` variants exist for a reason.** `forge-ink`, `spark-ink`, `quench-ink`,
  `destructive-ink` are the AA-passing text versions. Use the raw hue for fills, marks
  and charts; use the ink for any small text. `text-spark` on a light chip fails contrast.
- Both themes are defined at `:root` / `.dark`. Never define a color only inside a
  `dark:` variant — style through the tokens instead.
- Anything inside the sidebar must use `sidebar-*` tokens. The sidebar is dark in **both**
  themes, so page tokens like `text-muted-foreground` would be dark-on-dark.

## Typography

- `.type-display` — Archivo, for page/card titles and big numerals. Never for body copy.
- `.type-label` — IBM Plex Mono uppercase, for eyebrows and micro-labels.
- `.type-readout` — IBM Plex Mono tabular, for every number, metric and timestamp.
- Body copy is Instrument Sans (the default `font-sans`) — do not set it explicitly.
- Use `<PageHeader>` from `components/shared/page-header.tsx` for page titles, not a
  bare `<h1 className="text-3xl font-bold">`.
- Use `<EmptyState>` from `components/shared/empty-state.tsx` for empty/locked states —
  never a centered icon-in-a-circle card.

## Internationalization (i18n)

- **Never hardcode user-facing strings** in components
- Always use `useTranslations('namespace')` from `next-intl`
- When adding any visible text, add the key to **all 3 locale files**:
  - `messages/pt-br.json` ← default language
  - `messages/en.json`
  - `messages/es.json`
- Default language is **pt-br** — write translations there first

## Dark Mode

- All components must work in both light and dark mode
- Use `dark:` Tailwind variants for color overrides
- Do not use `next-themes` `useTheme` directly in leaf components — use the Tailwind variants instead
- Test both modes before committing

## Forms

- Always use shadcn `Form` wrapper + `react-hook-form` + `zod` schema
- Never build a form with raw `useState` for each field
- Show field-level validation errors inline (not toast)
- Disable submit button and show spinner while submitting

## API Calls

- Use the `ApiClient` singleton from `lib/api.ts` — never use `fetch()` directly
- Catch `ApiError` and display user-friendly messages via `toast` (sonner)
- Never swallow errors silently

## Component Patterns

- Use `cn()` from `lib/utils.ts` for className merging (tailwind-merge + clsx)
- Use `'use client'` only where interactivity is required — prefer Server Components for data display
- No Redux or Zustand — use React Context for global state, `useState` for local state

## File Naming

- Components: `PascalCase.tsx`
- Hooks: `use-kebab-case.ts`
- Utilities: `kebab-case.ts`
- Pages: `page.tsx` (Next.js App Router convention)
