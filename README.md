# foji-ui

Admin dashboard for the Foji platform. Manage agents, files, billing, team members, and platform administration.

## Tech

- Next.js 15 / React 19 / TypeScript
- Tailwind CSS 4 + shadcn/ui
- next-intl (pt-br, en, es)
- AWS Amplify Hosting

## Local Development

```bash
npm install
npm run dev
```

Runs on `http://localhost:3000`.

## Environment

Create a `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_AI_API_URL=http://localhost:8000
NEXT_PUBLIC_WIDGET_URL=http://localhost:4321
```

## Deploy

- **Dev**: Push to `main` triggers deploy via GitHub Actions to Amplify.
- **Prod**: Manual `workflow_dispatch` with confirmation.
