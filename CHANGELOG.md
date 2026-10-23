# Changelog

Todos los cambios relevantes del proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Changed
- Node fijado en 22 LTS (`.nvmrc` 22.22.3, `engines` `>=22.22.3 <23`).
- `lint` falla también con warnings (`--max-warnings=0`).

### Added
- `packages/ui`: tokens de diseño como variables CSS y preset de Tailwind v4
  (`@league/ui/styles.css`), fuentes Saira Condensed e Inter auto-alojadas,
  escala tipográfica 1.25, componente `Button` con Storybook.
- `packages/config`: presets de ESLint y `tsconfig` para React.
- Monorepo con pnpm workspaces y Turborepo; Node LTS fijado en `.nvmrc`.
- `packages/config`: ESLint (flat config, type-aware), Prettier, `tsconfig` base
  estricto y configuración base de Vitest.
- `packages/core`: paquete de dominio vacío con un test de ejemplo.
- `packages/contracts`: Zod y el esquema de ejemplo `HealthResponse`.
- Scripts raíz: `dev`, `build`, `lint`, `typecheck`, `test`, `format`.
- CI en GitHub Actions: lint, typecheck, test y build de lo afectado en cada PR.
