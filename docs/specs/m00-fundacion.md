# Módulo 00 — Fundación

> Spec para Claude Code. Objetivo: dejar el monorepo listo para construir todos
> los módulos siguientes, con CI, Supabase local, tokens de diseño y auth base.
> Se entrega en **3 PRs encadenados**.

---

## PR 00a — Monorepo y CI (`feat/m00a-monorepo`)

Alcance:
- pnpm workspaces + Turborepo en la raíz. `.nvmrc` con Node LTS.
- `packages/config`: ESLint, Prettier, `tsconfig` base (strict), Vitest base.
- `packages/core`: paquete vacío con un test de ejemplo que pase.
- `packages/contracts`: paquete con Zod y un esquema de ejemplo (`HealthResponse`).
- Scripts raíz: `dev`, `build`, `lint`, `typecheck`, `test`, `format`.
- GitHub Actions: en cada PR corre lint, typecheck, test y build (solo lo
  afectado con Turbo).
- `CHANGELOG.md` inicial.

Criterios de aceptación:
- [ ] `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
      pasa desde cero.
- [ ] El workflow de CI corre y pasa en el PR.
- [ ] Ninguna dependencia con `^` o `~`.

## PR 00b — Esqueletos de web y API + tokens (`feat/m00b-apps-tokens`)

Alcance:
- `apps/api` (NestJS): endpoint `GET /health` que responde con el esquema
  `HealthResponse` de `packages/contracts`. Estructura de módulos hexagonal de
  ejemplo (`modules/health/{domain,application,infrastructure,presentation}`).
  Validación de variables de entorno con Zod al arrancar. `.env.example`.
- `apps/web` (Next.js App Router + Tailwind): tres zonas con layout propio:
  `/` (público), `/app` (portal), `/admin` (consola). Página de inicio pública
  con el logo (`brand/logo/PentaLeague_Plata.svg`) y una llamada a `/health` de
  la API mostrando el estado.
- `packages/ui`: tokens de `docs/08-design-system.md` como variables CSS +
  preset de Tailwind (colores, acentos por circuito, tipografías Saira Condensed e
  Inter auto-alojadas, escala tipográfica 1.25). Un componente `Button` con
  Storybook como ejemplo.
- `packages/i18n`: configuración `es-419` y los textos de las páginas creadas.
- Nada de nombre de marca hardcodeado: el nombre y el logo vienen de un archivo
  de configuración de marca por ahora (`apps/web/src/config/brand.ts`), que luego
  se reemplazará por datos de la organización.

Criterios de aceptación:
- [ ] `pnpm dev` levanta web y API; la home muestra el logo y "API: ok".
- [ ] Los colores y fuentes de la web salen de `packages/ui` (no hay hex sueltos
      en componentes).
- [ ] Storybook arranca y muestra `Button`.
- [ ] Test unitario del caso de uso de health y test E2E (Playwright) de la home.

## PR 00c — Supabase local y auth base (`feat/m00c-supabase-auth`)

Alcance:
- `supabase init` en `supabase/`. Primera migración: tabla `users` (perfil 1:1
  con `auth.users`), `organizations`, `organization_members` (columnas de
  `docs/03-modelo-datos.md`, solo las necesarias para este módulo) con RLS.
- Trigger: al crear un usuario en `auth.users` se crea su fila en `users`.
- Seed: la organización "PENTA League" y un usuario super admin de desarrollo.
- Tipos de la base generados con Supabase CLI hacia `packages/db`.
- Supabase Auth en `apps/web`: login y registro con **correo + contraseña**,
  **magic link** y **Discord**. Google queda preparado por configuración.
- Rutas `/app` y `/admin` protegidas (redirigen a login). `/admin` exige
  `platform_role = super_admin` por ahora.
- `apps/api`: guard que verifica el JWT de Supabase y expone el usuario actual en
  `GET /me`.

Criterios de aceptación:
- [ ] `supabase start` + `supabase db reset` crea esquema y seed sin errores.
- [ ] Registro por correo crea fila en `users` automáticamente.
- [ ] Usuario sin sesión no entra a `/app` ni `/admin`; usuario normal no entra a
      `/admin`.
- [ ] `GET /me` responde 401 sin token y el usuario con token válido.
- [ ] Tests de integración de las políticas RLS (un usuario no lee datos de otra
      organización).
- [ ] `.env.example` documenta las variables de Supabase y Discord OAuth.

## Fuera de alcance
Perfil completo, vinculación Riot, equipos, torneos y cualquier otro módulo.

## Requisitos del entorno
- Docker (o OrbStack) para `supabase start`.
- App de Discord creada en el Discord Developer Portal para OAuth (client id y
  secret en `.env.local`, nunca en el repo).
