# foji-ui — Plan

## Role in the Foji AI Ecosystem

`foji-ui` is the **management dashboard** for Foji AI. It is a Next.js 15 PWA where clients sign up, manage their companies, create agents, invite team members, upload context files, and manage billing. It also includes a super-admin area for platform management.

---

## Tech Stack

- **Next.js 15** — App Router
- **React 19** — Hooks-only, no class components
- **Tailwind CSS 4** — Utility-first, with custom brand palette
- **shadcn/ui** (New York variant) — All UI components
- **next-themes** — Dark mode (light/dark/system)
- **next-intl** — i18n (pt-br default, en, es)
- **next-pwa** — PWA service worker, manifest
- **react-hook-form + zod** — Form validation
- **recharts** — Analytics charts

---

## Brand

```
Primary:   #FF2D2D  → Tailwind: text-primary / bg-primary
Secondary: #FF5A1F  → Tailwind: text-secondary / bg-secondary
Accent:    #FFB300  → Tailwind: text-accent / bg-accent
Dark bg:   zinc-950
Light bg:  white / zinc-50
```

**Logos** (in `/public/`):
- `logo-horizontal.png` → sidebar header (`logo3_foji.png` source)
- `logo-icon.png` → favicon, PWA icon (`favicon_foji.png` source)

**Motto** (i18n key `common.motto`):
- pt-br: "Forje sua inteligência"
- en: "Forge your intelligence"
- es: "Forja tu inteligencia"

---

## PWA Setup

```
public/
├── manifest.json             # name, icons, display: standalone, theme_color: #FF2D2D
├── icon-192.png
└── icon-512.png
next.config.ts                # withPWA() wrapper, service worker config
```

Offline fallback page shown when network unavailable.

---

## Route Structure

```
app/
├── (auth)/
│   ├── login/
│   ├── signup/
│   ├── verify-email/
│   ├── forgot-password/
│   ├── reset-password/
│   └── accept-invitation/[token]/
├── (onboarding)/
│   ├── create-company/
│   └── select-plan/
├── (dashboard)/
│   ├── layout.tsx            # Sidebar + header, company switcher
│   ├── dashboard/            # Overview: agent count, chat volume, plan usage
│   ├── agents/
│   │   ├── page.tsx          # Agent list + create button
│   │   └── [id]/
│   │       ├── page.tsx      # Edit agent (name, prompts, language)
│   │       ├── files/        # Upload/manage context files
│   │       └── embed/        # Embed code + test widget
│   ├── team/                 # Members list, invite modal, role management
│   ├── billing/              # Current plan, usage bars, Stripe portal
│   ├── settings/             # Company name, logo, slug
│   └── admin/                # Super-admin only
│       ├── companies/
│       ├── plans/
│       ├── models/           # AI model management
│       └── system-stats/
├── api/
│   └── auth/login/           # Server-side login route (optional)
└── layout.tsx                # Root: ThemeProvider, IntlProvider, AuthProvider
```

---

## Auth & State

**AuthProvider** (Context):
- JWT stored in `localStorage` key: `foji_token`
- Decoded to extract: `userId`, `email`, `companies`, `isSuperAdmin`
- Active company stored in `localStorage` key: `foji_active_company`
- `hasRole(role)` — checks role in active company
- `isSuperAdmin()` — global admin check

**JWT Claims shape**:
```ts
interface JwtPayload {
  userId: number;
  email: string;
  isSuperAdmin: boolean;
  companies: { companyId: number; role: 'owner' | 'admin' | 'user' }[];
}
```

---

## User Profile Modal

Triggered from header avatar button. Uses shadcn `Dialog`.

**Personal info tab**:
- First name, Last name (editable, auto-save on blur or explicit save)
- Email (read-only; shows verification badge)
- Change password (current + new + confirm)

**Preferences tab**:
- Dark mode: Radio group → Light / Dark / System (applies immediately via `next-themes`)
- UI language: Select → Português BR / English / Español (applies immediately via `next-intl`, saves to DB + `localStorage`)

---

## Company Switcher

Sidebar header dropdown:
- Lists all companies from JWT `companies` array
- Selecting one updates `foji_active_company` in `localStorage`
- Page refreshes active company context (company name, logo, plan badge)
- "Create new company" option at bottom

---

## Agent Create Flow (4-step)

1. **Name & Description** — text inputs
2. **Industry** — 3 cards: Accounting & Finance / Law / Internal Systems (with icon + description)
3. **Prompts** — view auto-generated system prompt (read-only preview) + textarea for user additions + language selector (pt-br/en/es for agent responses)
4. **Files** — drag & drop, up to 30MB per file, shows upload + extraction progress

Result: embed code shown with copy button.

---

## Key Components

```
components/
├── ui/                         # shadcn/ui primitives (never raw HTML for UI)
│   ├── loading-spinner.tsx     # <LoadingSpinner size="sm|md|lg|xl" /> — use everywhere
│   └── ...
├── auth/
│   ├── auth-provider.tsx       # JWT context
│   └── role-guard.tsx          # <RoleGuard role="admin"> wrapper
├── layout/
│   ├── sidebar.tsx
│   ├── header.tsx              # Avatar → profile modal trigger
│   ├── company-switcher.tsx
│   └── bottom-nav.tsx          # Mobile only: Dashboard / Agents / Team / Billing
├── agents/
│   ├── agent-card.tsx
│   ├── create-agent-wizard.tsx
│   ├── industry-picker.tsx
│   └── embed-code-display.tsx
└── profile/
    └── user-profile-modal.tsx
```

---

## CLAUDE.md Rules (enforced during development)

> ⚠️ **These rules apply to every file in this repo:**

1. **Always use shadcn/ui components** — never raw HTML elements for UI chrome (inputs, buttons, dialogs, selects, checkboxes, modals)
2. **Never use native browser `alert()`, `confirm()`, or `prompt()`** — always use shadcn `AlertDialog` or `Dialog`
3. **Never use native `<select>` unstyled** — always use shadcn `Select`
4. **Loading spinner**: import and use `<LoadingSpinner />` (from `components/ui/loading-spinner.tsx`) on every page load, async data fetch, and form submit — never leave a blank screen
5. **Colors**: use only Tailwind color tokens (`text-primary`, `bg-secondary`, `border-accent`) — never hardcode hex in components
6. **i18n**: never hardcode user-facing text — use `useTranslations()` and add keys to all 3 files: `messages/en.json`, `messages/pt-br.json`, `messages/es.json`
7. **Dark mode**: use `dark:` Tailwind variants — never inline `style={{ color: '#fff' }}`
8. **Forms**: always use `shadcn Form` + `react-hook-form` + `zod` schema validation
9. **Dialogs for destructive actions**: always use `AlertDialog` with confirm step before deletes

---

## API Client

`lib/api.ts` — Singleton `ApiClient`:
- Methods: `get<T>()`, `post<T>()`, `put<T>()`, `patch<T>()`, `delete<T>()`
- Auto-injects `Authorization: Bearer <token>`
- Throws `ApiError` with status + validation errors
- Base URL from `NEXT_PUBLIC_API_URL`

---

## i18n Structure

```
messages/
├── pt-br.json    ← DEFAULT
├── en.json
└── es.json
```

Namespace per feature: `useTranslations('agents')`, `useTranslations('billing')`, etc.

---

## Environment Variables

```
NEXT_PUBLIC_API_URL            # https://api-dev.foji.ai or https://api.foji.ai
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL            # for PWA manifest
```

---

## Deploy Target

**Vercel** — Next.js first-class support, PWA-compatible
- Dev: auto-deploy on push to `main`
- Prod: `workflow_dispatch`

---

## Connections to Other Services

| Service | How |
|---------|-----|
| `FojiApi` | REST API — all data operations |
| `foji-widget` | Generates embed code pointing to widget |
| Stripe | Redirects to Stripe Checkout / Customer Portal (URLs from FojiApi) |
