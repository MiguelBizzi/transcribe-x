# TranscribeX frontend

Next.js app for TranscribeX.

## Requirements

- Node.js 24 LTS (see `.nvmrc`)
- [PNPM](https://pnpm.io/) 10 (`corepack enable` then `corepack prepare pnpm@10.34.5 --activate`)

Bun, npm, and Yarn are not used in this project.

## Setup

```bash
cp env.example .env.local
# NEXT_PUBLIC_API_URL should point at the Fastify API (default http://localhost:3333)

pnpm install
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Next.js dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm typecheck` | TypeScript `--noEmit` |
| `pnpm lint` | ESLint |
