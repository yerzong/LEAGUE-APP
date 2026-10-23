# CLAUDE.md — PENTA League

Instructions for Claude Code. Read this file fully at the start of every session.

## What this project is
A platform to run an amateur League of Legends league (PENTA League) for Mexico/LATAM
with LCK-style production: tournaments of any format, teams, players, Riot
integration, Discord bot, overlays, notifications. Multi-tenant from day one so it
can become a SaaS later.

## Source of truth
Planning lives in `docs/`. **Do not change a decision documented there.** If a
task conflicts with the docs, stop and ask.

| Need | Read |
|------|------|
| Stack, monorepo, modules, build order | `docs/04-arquitectura.md` |
| Data model (tables, constraints) | `docs/03-modelo-datos.md` |
| Coding standards, patterns, tests, definition of done | `docs/17-estandares-ingenieria.md` |
| Business rules (formats, eligibility, integrity) | `docs/02-formatos-competencia.md`, `docs/13-reglas-integridad.md` |
| Screens and modules | `docs/14-modulos-funcionales.md` |
| Auth, roles, profiles | `docs/12-auth-roles-perfiles.md` |
| Design tokens and brand | `docs/08-design-system.md`, `brand/logo/` |
| Current module spec | `docs/specs/<module>.md` |

## Stack (fixed)
- TypeScript everywhere, `strict`. Node.js LTS (pin in `.nvmrc`).
- pnpm workspaces + Turborepo.
- `apps/web`: Next.js App Router + React + Tailwind. Zones: `/` public site,
  `/app` player portal (PWA), `/admin` console.
- `apps/api`: NestJS. Hexagonal modules (domain / application / infrastructure /
  presentation).
- Supabase: Postgres, Auth, Storage, Realtime. Migrations ONLY via Supabase CLI
  (`supabase/migrations`, SQL). RLS on every business table.
- Development uses the cloud project `penta-dev` (no Docker on the dev machine).
  **Never connect to, push to, or query the production project.** CI runs a
  local Supabase with `supabase start` for integration tests.
- Jobs: transactional outbox + pg-boss. No Redis, no Kafka.
- Validation: Zod schemas in `packages/contracts`, shared by web, api, bot, mobile.
- Tests: Vitest (unit/integration), Playwright (E2E), Storybook (UI).
- Do NOT add other languages/frameworks (no Angular, Vue, Java, .NET, Prisma
  unless the docs say so). Python only in `apps/media-service`.

## Non-negotiable rules
1. **Domain logic lives in `packages/core`**: pure TypeScript, no framework, no
   DB, no network. Standings, formats, tiebreakers, Fearless, eligibility.
2. **External services only behind ports** (`packages/integrations`): Riot,
   Discord, email, social, LLM, storage, payments.
3. **All business writes go through the API** (use case + permission check +
   audit). Clients never write business tables directly.
4. **Never hardcode brand**: name, logo, colors and copy come from configuration
   (`organizations`, `brand_themes`, i18n). UI text in Spanish (`es-419`) via
   i18n; code identifiers in English.
5. **Strict TDD for `packages/core`** and use cases: RED → GREEN → REFACTOR.
6. **Security**: Zod validation at every boundary, permission guards in NestJS,
   RLS in Postgres, no secrets or PII in logs, no service-role key in clients.
7. **Dependencies**: pin exact versions (no `^`/`~`). Prefer well-known packages.
8. Generic components already defined (DataTable, ConfirmDialog, Toast, Wizard,
   FormField, Uploader, EmptyState, ErrorState, Skeleton): reuse, do not duplicate.

## Git workflow
- One branch per module slice: `feat/mXX-short-name`.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
  No AI attribution / Co-Authored-By lines.
- PRs under ~400 changed lines (generated files and lockfiles excluded); split
  into chained PRs otherwise.
- Never push to `main` directly. Open a PR with `gh pr create`.
- Before opening a PR, all of these must pass:
  `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## How each module is done
1. Read the module spec in `docs/specs/`.
2. Implement only what the spec lists. Out of scope = do not build.
3. Tests first for domain and use cases.
4. Update docs/CHANGELOG if behavior or structure changed.
5. Finish with a short summary: what was built, how to run it, what was not done
   and why.
