# KeptNow

A household inventory management app that helps you track food items across your pantry, fridge, and freezer with smart expiration monitoring and AI-powered receipt scanning.

## Features

- **Inventory tracking** — Manage food items by storage location (pantry, fridge, freezer) with quantity or amount-based tracking
- **Expiration alerts** — Automatic warnings for items expiring soon or already expired
- **Receipt scanning** — Upload grocery receipts and let AI extract items with estimated expiration dates
- **Restock tab** — See everything that needs attention with quick-shop links
- **Recipe management** — Scan recipes from photos, match ingredients against your inventory, see cook-readiness at a glance
- **Households** — Invite family members, share inventory and recipes across a household
- **PWA support** — Install as a native-feeling app on iOS and Android

## Tech Stack

- **Frontend**: SvelteKit, Svelte 5, Tailwind CSS 4, TypeScript
- **Backend**: PostgreSQL, Drizzle ORM, Better Auth
- **AI**: Anthropic Claude (receipt scanning via Vercel AI SDK)
- **Architecture**: Effect.ts, domain-driven design, repository pattern

## Setup

### Prerequisites

- Node.js (pnpm recommended)
- Docker & Docker Compose

### Install

```sh
pnpm install
```

### Environment

Copy `.env.example` to `.env` and fill in the values:

```sh
cp .env.example .env
```

Required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - 32-character secret for auth
- `ANTHROPIC_API_KEY` - For receipt scanning
- `ORIGIN` - App origin URL (e.g. `http://localhost:5173`)

### Development

The easiest way to start is with [just](https://github.com/casey/just), which handles the database and dev server:

```sh
just dev
```

Or manually:

```sh
docker compose up -d        # Start PostgreSQL
npm run db:push             # Push schema
npm run dev                 # Start dev server at http://localhost:5173
```

### Build

```sh
npm run build
npm run preview
```

## Scripts

| Command               | Description                    |
| --------------------- | ------------------------------ |
| `npm run dev`         | Start dev server               |
| `npm run build`       | Production build               |
| `npm run check`       | TypeScript & Svelte validation |
| `npm run lint`        | Prettier + ESLint              |
| `npm run format`      | Auto-format code               |
| `npm run test`        | Run unit tests                 |
| `npm run db:push`     | Push schema to database        |
| `npm run db:generate` | Generate migration files       |
| `npm run db:migrate`  | Run migrations                 |
| `npm run db:studio`   | Open Drizzle Studio            |
