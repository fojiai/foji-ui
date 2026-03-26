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

- Use only Tailwind color tokens: `text-primary`, `bg-primary`, `text-secondary`, `bg-secondary`, `text-accent`, `bg-accent`
- **Never hardcode hex values** (`#FF2D2D`, etc.) in component files
- Dark mode via `dark:` Tailwind variants — never inline `style={{ color: '...' }}`
- Brand palette is defined in `tailwind.config.ts`:
  - `primary`: `#FF2D2D`
  - `secondary`: `#FF5A1F`
  - `accent`: `#FFB300`

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
