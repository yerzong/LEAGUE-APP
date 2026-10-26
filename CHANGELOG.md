# Changelog

Todos los cambios relevantes del proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added (m02 — perfiles, cuenta de Riot y equipos)
- Migración `profiles_riot_and_teams` (aplicada en `penta-dev`): columnas de
  perfil en `users`, `user_private_data`, `user_social_links`,
  `user_privacy_settings`, `riot_accounts` (`UNIQUE (puuid) WHERE unlinked_at
  IS NULL`), `riot_verification_attempts`, `riot_rank_snapshots`,
  `riot_id_history`, `clubs`/`club_members` (solo tablas), `teams` (nombre y tag
  únicos por organización), `team_members` (`UNIQUE (team_id, user_id) WHERE
  left_at IS NULL`, un capitán), `team_invitations`, `team_join_requests`,
  `team_captaincy_transfers`, `team_name_history`, `free_agent_listings` y
  `audit_logs` (append-only). RLS en todas, grants explícitos, buckets públicos
  `avatars` y `team-logos` (solo escribe la API) y funciones `svc_*` atómicas.
  Tests pgTAP de RLS e integridad.
- `packages/core`: reglas de equipos (permisos por rol, límites de creación y
  capitanía, unirse, salir, quitar, cambiar rol, transferir capitanía).
- `packages/contracts`: esquemas de perfil, datos privados, privacidad, redes,
  verificación de Riot, equipos, invitaciones, solicitudes, agente libre,
  páginas públicas y errores de la API.
- `packages/integrations`: `RiotAccountPort` con adaptador de la API de Riot
  (account-v1, summoner-v4, league-v4) y stub en memoria.
- API: módulos `identity` (perfil, onboarding, datos privados con género
  bloqueado tras declararlo, privacidad, redes, foto, búsqueda), `riot-accounts`
  (verificación por ícono, desvincular con auditoría), `teams` (crear, editar,
  logo, invitaciones por usuario o enlace, solicitudes, roles, salir, quitar,
  transferir capitanía, disolver con auditoría, agente libre) y `public-site`
  (páginas públicas que respetan la privacidad de cada jugador).
- Web: `/app/perfil`, `/app/riot`, `/app/equipos`, `/app/equipos/nuevo`,
  `/app/equipos/[slug]`, `/app/invitaciones/[code]`, `/app/agente-libre`,
  onboarding e invitaciones en `/app`; públicas `/equipos/[slug]` y
  `/jugadores/[username]`. Formularios con React Hook Form + Zod.
- `packages/ui`: `Field` y `Uploader`.
- E2E (Playwright): completar perfil, vincular Riot (stub), crear equipo,
  invitar y aceptar.

### Changed (m02)
- `IdentityModule` separa la verificación de tokens en un `AuthModule` global.
- CI: el job de verificación levanta Supabase local para los E2E; el de base de
  datos incluye Storage (las migraciones crean buckets).
- `apps/web/vitest.config.js`: el alias `@` decodifica la ruta (fallaba con
  espacios en el directorio).

### Added (m01 — motor de torneos)
- `packages/core` con TDD y cobertura mínima obligatoria (95/90/95/95):
  - Series Bo1/Bo3/Bo5 a partir de sus partidas, con validación de coherencia.
  - Sistema de puntos configurable (victoria/derrota/empate + bonus) y
    desempates como Chain of Responsibility que reporta el criterio y el valor
    de cada separación y marca los empates que requieren tiebreaker manual.
  - Formatos como Strategy con registro abierto: round robin (una y dos
    vueltas), grupos, eliminación simple (byes, tercer lugar), eliminación
    doble (gran final y reset opcional) y suizo (sin revanchas, byes, umbrales
    de avance/eliminación).
  - Fearless Draft por equipo (y variante global) con validación de draft.
  - Motor de elegibilidad con Specification: rango, peak, promedio del equipo,
    cuenta, edad, género con `declared_before`, institución, tier máximo,
    exclusividad con cooldown, sanciones y nombre legal.
  - Máquinas de estado de torneo, serie y partida con errores tipados.
  - `packages/core/README.md` con la API pública y ejemplos (probados).
- `packages/i18n`: mensajes es-419 para cada motivo de no elegibilidad.

### Added (m0d — design system)
- `packages/ui` sobre shadcn/ui (new-york, Radix) adaptado a los tokens:
  átomos (Button, Input, Textarea, Select, Checkbox, Switch, RadioGroup, Label,
  Badge con acentos por circuito, Avatar, Separator, Skeleton, Spinner, Tooltip,
  Kbd, GlassPanel), moléculas (FormField, Card, Dialog, AlertDialog,
  ConfirmDialog con motivo obligatorio, DropdownMenu, Tabs, Toast, Command,
  Pagination, Popover, Sheet) y organismos (DataTable con orden, filtro,
  paginación, selección, acciones en lote y estados; AppShell; PageHeader;
  EmptyState; ErrorState; Table). Story de Storybook para cada uno.
- Tokens "afilados" (radios), alias semánticos, utilidades `caps`, `hairline`,
  `focus-ring`, `glass`, `tabular`; modo oscuro único.
- Animaciones con Motion: `FadeIn`, `SlideUp`, `Stagger`, `PageTransition`;
  `prefers-reduced-motion` las desactiva (CSS, sin desajuste de hidratación).
- `/admin/kitchen-sink` (super_admin; activo en desarrollo o con
  `KITCHEN_SINK_ENABLED=true`) con todos los componentes y estados.
- AppShell en `/admin` y `/app`; `Toaster` y `TooltipProvider` globales.
- Tests de contraste AA, paridad de tokens de movimiento, DataTable,
  ConfirmDialog, AppShell y primitivas de movimiento.

### Changed (m0d)
- `Button` migrado a `cva` + `asChild` conservando su API (`primary`,
  `secondary`, `ghost`; `sm`, `md`, `lg`) y con nuevas variantes.
- `FormField` usa los átomos `Label` e `Input`, misma API.
- ESLint (`@league/config/eslint-react`): solo tokens en componentes.
- Vitest usa caché por paquete (evita carreras al correr en paralelo).
- `apps/web`: `lint` corre `next typegen` antes de ESLint (fallaba en un checkout
  limpio porque `PageProps` se genera en `.next/`).

### Added (00c)
- Supabase: `supabase/config.toml` vinculado a `penta-dev`, sin exposición
  automática de tablas, confirmación de correo obligatoria, Discord activo y
  Google preparado (credenciales por variables de entorno).
- Migración `identity_and_organizations`: `users` (1:1 con `auth.users`),
  `organizations` y `organization_members` con RLS de solo lectura y `GRANT`
  explícitos a `authenticated`; trigger que crea el perfil al registrarse;
  helpers en el esquema `private` (UUID v7, `updated_at`, chequeos de RLS).
- Seed de desarrollo: organización "PENTA League" y super admin local.
- Tests pgTAP de RLS y del trigger (`supabase/tests`), en CI con `supabase start`.
- `packages/db`: tipos generados con `supabase gen types` (`pnpm db:types`).
- `apps/api`: `AccessTokenGuard` verifica el JWT de Supabase (firma contra el
  JWKS del proyecto) y `GET /me` devuelve el usuario actual (`MeResponse`);
  401 sin token o con token inválido. Nuevas variables `SUPABASE_URL` y
  `SUPABASE_PUBLISHABLE_KEY`.
- `packages/contracts`: esquemas de credenciales (`SignUpSchema`, etc.).
- `packages/ui`: componente `FormField` con Storybook.
- `packages/i18n`: textos de login, registro y errores de auth.
- `apps/web`: sesión de Supabase con cookies (`@supabase/ssr`); `proxy.ts`
  refresca la sesión y protege las zonas: `/app` exige sesión y `/admin` exige
  `platform_role = super_admin` (verificado también en los layouts). Cierre de sesión.
- `supabase/config.toml` alineado con `penta-dev` (MFA TOTP activo, pooler, OTP).
- `apps/web`: login y registro con correo + contraseña, magic link y Discord
  (Google preparado con `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`); `/auth/callback`
  para OAuth, magic link y confirmación de correo.

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
