# TranscribeX API

Fastify + Prisma API for TranscribeX.

## Requirements

- Node.js 24 LTS (see `.nvmrc`)
- [PNPM](https://pnpm.io/) 10 (`corepack enable` then `corepack prepare pnpm@10.34.5 --activate`)
- Docker (for local PostgreSQL 16)
- Python 3 (YouTube transcript script)

Bun and npm are not used in this project.

## Setup

```bash
cp env.example .env
# Edit .env with real secrets and API keys

docker compose up -d
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm dev
```

The API listens on `SERVER_PORT` (default `3333`). Docs: http://localhost:3333/docs

Local Postgres is published on **5433** (not 5432) so it does not collide with other databases on this machine. `DATABASE_URL` must use that port.

If you previously used the Postgres 14/18 Compose volume, reset it once:

```bash
docker compose down -v
docker compose up -d
pnpm db:deploy
```

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Start the API with `tsx` watch |
| `pnpm start` | Start the API without watch |
| `pnpm typecheck` | TypeScript `--noEmit` |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Generate Prisma Client |
| `pnpm db:migrate` | Create/apply a development migration |
| `pnpm db:deploy` | Apply migrations |
| `pnpm db:reset` | Reset the database |
| `pnpm db:studio` | Open Prisma Studio |

Prisma Client is generated to `src/generated/prisma` on `pnpm install` (`postinstall`).
