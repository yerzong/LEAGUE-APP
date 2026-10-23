# Changelog

Todos los cambios relevantes del proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Changed
- Node fijado en 22 LTS (`.nvmrc` 22.22.3, `engines` `>=22.22.3 <23`).
- `lint` falla también con warnings (`--max-warnings=0`).

### Added
- `apps/web` (Next.js App Router + Tailwind v4): zonas `/` (público), `/app`
  (portal) y `/admin` (consola) con layout propio. La home muestra el logo y el
  estado de la API. Nombre y logo desde `src/config/brand.ts`.
- E2E con Playwright de la home (`pnpm test:e2e`), también en CI.
- `apps/api` (NestJS): `GET /health` con el contrato `HealthResponse`, módulo
  hexagonal de ejemplo (`modules/health/{domain,application,infrastructure,presentation}`),
  variables de entorno validadas con Zod al arrancar y `.env.example`.
- `packages/ui`: tokens de diseño como variables CSS y preset de Tailwind v4
  (`@league/ui/styles.css`), fuentes Saira Condensed e Inter auto-alojadas,
  escala tipográfica 1.25, componente `Button` con Storybook.
- `packages/config`: presets de ESLint y `tsconfig` para React.
- `packages/i18n`: configuración `es-419` y los textos de las páginas.
- Monorepo con pnpm workspaces y Turborepo; Node LTS fijado en `.nvmrc`.
- `packages/config`: ESLint (flat config, type-aware), Prettier, `tsconfig` base
  estricto y configuración base de Vitest.
- `packages/core`: paquete de dominio vacío con un test de ejemplo.
- `packages/contracts`: Zod y el esquema de ejemplo `HealthResponse`.
- Scripts raíz: `dev`, `build`, `lint`, `typecheck`, `test`, `format`.
- CI en GitHub Actions: lint, typecheck, test y build de lo afectado en cada PR.
