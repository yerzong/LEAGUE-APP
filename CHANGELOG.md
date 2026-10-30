# Changelog

Todos los cambios relevantes del proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Added (m07 — bot de Discord)
- `apps/bot`: proceso con discord.js que registra los slash commands por guild y
  enruta cada interacción a la API. Guard: sin token (o config incompleta) el bot
  no arranca pero el resto del stack sigue corriendo. Comandos `/proximo`,
  `/tabla`, `/perfil`, `/equipo`, `/checkin`, `/vincular`. Tests con discord.js y
  `fetch` mockeados (nunca llama a Discord real en CI).
- `packages/integrations`: `DiscordPort` con adaptador REST (`@discordjs/rest`),
  un fake para tests/CI, builders de embeds con color de marca y las definiciones
  de los slash commands.
- Migraciones `discord` y `discord_identity_link` (aplicadas en `penta-dev`):
  `discord_guilds`, `discord_channel_links`, `discord_temp_channels` y
  `user_discord_links` (un trigger copia el Discord ID de `auth.identities` al
  entrar con Discord; `/vincular` cubre a quienes entraron por correo). RLS:
  config y canales solo para super admin; cada usuario ve solo su vínculo; la
  contabilidad de canales de voz solo por la API. `svc_*` auditadas. Tests pgTAP.
- `apps/api` módulo `discord`: el `DiscordChannelPort` que consume el motor del
  m06 (DM al jugador, o canal de staff para avisos), endpoints `/bot/*` protegidos
  por un secreto compartido, reconciliador de canales de voz por estado de
  partida y rol automático de "jugador verificado". Disponible solo con token
  (`DISCORD_PROVIDER=bot`); con `stub` el motor no encola Discord.
- `packages/contracts`: config del admin de Discord y el contrato bot↔API.
- `apps/web`: consola `/admin/discord` (conectar servidor, canales, funciones) e
  i18n es-419.

### Added (m09 — estadísticas y perfiles pro)
- Migraciones `stats_achievements_follows` y `stats_attach_sides` (aplicadas en
  `penta-dev`): `player_game_stats`, `team_game_stats`, `game_timeline_events`,
  `player_aggregate_stats` (por torneo, temporada, circuito e histórico, con el
  radar), `player_champion_stats`, `team_aggregate_stats`,
  `champion_meta_stats`, `achievements` (9 logros base), `user_achievements`,
  `mvp_awards`, `follows` y la cola `stats_jobs` (un trigger la llena al cerrarse
  una partida o al llegar los datos de un game). RLS: agregados y meta públicos
  (y en Realtime); las líneas por game (llevan el PUUID), la cola, logros y MVP
  solo por la API; cada usuario ve solo sus follows. `svc_*` para reclamar
  trabajo, guardar un recálculo completo de forma atómica e idempotente, cargar
  datos de partida (con los lados reales) y editar logros, auditados. Tipo de
  notificación `follow.match_scheduled` para seguidores. Tests pgTAP.
- `packages/core`: stats por game (KDA, CS/oro/daño/visión por minuto,
  participación en kills, % de daño, puntuación de desempeño, MVP, momentos
  notables), agregados con el radar de 0–100 contra rangos fijos, campeones,
  equipo, meta, evolución semanal, forma, head-to-head, MVP por ámbito y motor
  de logros por reglas.
- `packages/integrations`: normalizador Match-V5 y catálogo de campeones de Data
  Dragon (es_MX, en caché; uno estático para tests y CI).
- `packages/contracts`: datos Match-V5, perfiles con stats, head-to-head, equipo,
  torneo, box score, follows y reglas de logros.
- `packages/ui`: `StatRadar`, `BarList`, `TrendBars`, `FormGuide` y `Stat`.
- API: módulo `stats` (worker de la cola, recálculo, `PUT /admin/games/:id/match-data`,
  `GET /admin/matches/:id/match-data`, `POST /admin/tournaments/:id/stats/recalculate`,
  `GET|PUT /admin/achievements`, `/public/players/:username/stats`,
  `/public/players/:a/vs/:b`, `/public/teams/:slug/stats`,
  `/public/tournaments/:slug/stats`, `/public/matches/:id/stats` y
  `GET|POST|DELETE /me/follows`). Audiencia `followers` en el motor de
  notificaciones.
- Web: pro-stats en `/jugadores/[username]`, head-to-head en
  `/jugadores/[username]/vs/[other]`, stats y roster con mini-stats en
  `/equipos/[slug]`, líderes, meta de campeones y MVP en `/torneos/[slug]` (en
  vivo), box score en la página de partida, botón Seguir, `/app/siguiendo`,
  carga de datos de partida y recálculo en el admin, y `/admin/logros`.
- Seed demo: datos Match-V5 ficticios para los games de la Liga.
- E2E: el staff carga los datos de la final y aparecen las stats; seguir y dejar
  de seguir un equipo.

### Added (m06 — notificaciones in-app y correo)
- Migración `notifications` (aplicada en `penta-dev`): `notification_types`
  (catálogo de 18 tipos de docs/15 §3), `notification_templates` (plantillas
  base es-419 y las propias de la organización, con versión),
  `notification_rules`, `user_notification_preferences`, `notifications`
  (bandeja, en la publicación de Realtime), `notification_deliveries` (una por
  canal, `UNIQUE (source_event_id, user_id, channel)`; también es la cola de
  envío con reintentos) y `push_subscriptions` (estructura). `outbox_events`
  suma `next_attempt_at`, `locked_until`, `last_error` y `dead_at`. RLS: cada
  usuario lee solo su bandeja, sus entregas y sus preferencias; plantillas y
  reglas solo por la API. Funciones `svc_*` para reclamar trabajo con lease,
  escribir un evento completo de forma atómica e idempotente y auditar los
  cambios del admin. Tests pgTAP.
- `packages/core`: canales tras la regla y las preferencias (in-app siempre,
  críticas que no se apagan, anuncios opt-in), matriz de preferencias, render de
  plantillas `{{variable}}` y backoff de reintentos.
- `packages/integrations`: `EmailPort` con `ResendEmailAdapter` (HTTP, clave
  idempotente por entrega) y `FakeEmailAdapter` (captura los envíos).
- `packages/contracts`: bandeja, preferencias, tipos/reglas/plantillas, vista
  previa e historial de entregas.
- API: módulo `notifications` (worker del outbox y de entregas, mapeo de eventos
  existentes a tipos, `NotificationChannelPort` con adaptadores in-app y correo;
  Discord y push registrados sin implementar), `GET /notifications`,
  `POST /notifications/:id/read`, `POST /notifications/read-all`,
  `GET|PUT /me/notification-preferences` y `/admin/notifications/*` (tipos,
  regla, plantillas con vista previa y restaurar, historial de entregas).
- Web: campana con contador en vivo en `/app` y `/admin`, `/app/notificaciones`,
  `/app/ajustes/notificaciones`, `/admin/notificaciones` (tipos y reglas, editor
  de plantillas con vista previa) y `/admin/notificaciones/entregas`.
- E2E: la aprobación de una inscripción llega a la campana del capitán y al
  roster, y el staff ve las entregas por correo y la vista previa.

### Added (m0dev — herramientas de desarrollo)
- `pnpm seed:demo` / `pnpm seed:reset` (`apps/api/src/dev/seed`, fuera del build):
  escenario demo creado con los casos de uso reales de la API en proceso (Nest
  application context; solo el stub de Riot con rangos variados y el reloj, para
  reproducir las jornadas pasadas de la liga, se sustituyen): 54 jugadores con
  perfil y Riot verificado (6 agentes libres), 8 equipos de 5 + 1 con logo
  placeholder, temporada y circuito, Copa Relámpago (8 equipos, bracket
  programado), Liga Apertura (round robin de 6, 3 jornadas jugadas por doble
  reporte) y Torneo Abierto (inscripciones abiertas, regla de rango máximo).
  Idempotente; el reset borra lo marcado `demo` y anonimiza las cuentas que
  aparecen en la auditoría. Guard testeado: solo `penta-dev`, con
  `SEED_ENABLED=true`, nunca con `NODE_ENV=production` ni con la API encendida.
- Web: botón "Rellenar con datos de ejemplo" en el asistente de torneo, el perfil
  y crear equipo, solo con `NEXT_PUBLIC_DEV_TOOLS=true` y `penta-dev`; con la
  bandera apagada el código no entra al bundle (import dinámico eliminado).

### Added (m05 — partidas, resultados y standings)
- Migraciones `matches_results_standings` y `competition_keep_phase_seeds`
  (aplicadas en `penta-dev`): `matches` (con `version` para bloqueo optimista),
  `match_officials`, `match_checkins`, `reschedule_requests`, `games`,
  `game_participants`, `draft_actions`, vista `fearless_locks`,
  `result_reports`, `disputes`, `dispute_evidence`, `standings` y
  `standing_overrides`. RLS en todas (las partes de una partida ven sus
  reportes, disputas y reprogramaciones; solo la API escribe), `matches` y
  `standings` en la publicación de Realtime, bucket privado `match-evidence` y
  `svc_commit_competition` (aplica partidas, juegos, standings, auditoría y
  eventos en una transacción). Tests pgTAP.
- `packages/core`: conciliación del doble reporte, ventana y resultado del
  check-in (W.O.), plazo de disputa, calendario automático dentro de las
  ventanas de juego, progreso de fase (standings, clasificados y siembra de la
  siguiente fase) y horas por zona horaria.
- `packages/contracts`: vistas de partida, standings con criterios de desempate
  y tablero del torneo; solicitudes de reporte, disputa, resolución,
  reprogramación y horario.
- API: módulos `matches` (generar fixtures, check-in manual y automático,
  doble reporte con evidencia, resultado y W.O. del staff, disputas con
  evidencia y resolución), `scheduling` (calendario automático, horario manual
  auditado, reprogramación propuesta/aceptada/aprobada) y `standings`
  (`GET /public/tournaments/:slug/board`, `GET /admin/tournaments/:id/board`).
- `packages/ui`: `Bracket` y `StandingsTable`.
- Web: pestañas de fases, calendario, partidas y standings en
  `/admin/torneos/[id]` y gestión de cada partida; `/app/partidas` (mis
  partidas y centro de partida: check-in, reporte, disputa, reprogramación);
  bracket, calendario y resultados en `/torneos/[slug]` en vivo con Realtime y
  detalle público de la partida.
- E2E: torneo relámpago completo contra `penta-dev` (crear → inscribir →
  aprobar → fixtures → jugar → campeón) que borra sus datos.

### Added (m04 — torneos e inscripciones)
- Migración `tournaments_and_registrations` (aplicada en `penta-dev`):
  `seasons`, `circuits`, `circuit_tournaments`, `tournament_templates`,
  `tournaments` (tipo, tier, estado, visibilidad, modalidad, supervisión,
  co-stream, premios…), `tournament_game_settings`, `tournament_roster_rules`,
  `eligibility_rules`, `schedule_windows`, `schedule_blackouts`, `rulebooks`,
  `rulebook_versions` (versiones publicadas congeladas), `tournament_staff`,
  `tournament_prizes`, `prize_deliveries`, `entrants` (una inscripción activa por
  equipo y torneo), `entrant_roster_members` (índice parcial
  `UNIQUE (user_id, exclusivity_key)`: anti-chapulineo en la base de datos),
  `roster_change_requests`, `phases`, `groups`, `phase_entrants` y
  `outbox_events`. RLS en todas (un equipo no ve inscripciones ajenas que no
  estén aprobadas; solo la API escribe), funciones `svc_*` que guardan, auditan y
  emiten eventos en una transacción, bucket `tournament-covers`. Tests pgTAP.
- `packages/core`: reglas efectivas del torneo (exclusividad por ámbito), clave
  de exclusividad, validación de roster, política de edición por estado
  (docs/14 §3.2), ciclo de vida de la inscripción, siembra (manual, aleatoria,
  por rango promedio) y vista previa de la estructura de fases.
- `packages/contracts`: configuración completa del asistente
  (`TournamentConfigSchema`) y vistas de admin, portal y público.
- API: módulos `tournaments` (crear borrador, editar según estado, publicar con
  fases y grupos vacíos, abrir/cerrar/cancelar/archivar, reglamento con
  versiones, plantillas, auditoría) y `registrations` (validación en vivo,
  inscribir con elegibilidad y exclusividad de `core`, lista de espera, aprobar
  —con excepción manual auditada—, rechazar, retirar, siembra), y
  `GET /public/tournaments[/:slug]`. Solo staff (`super_admin`) administra.
- `packages/ui`: `Wizard` (pasos) y `Timeline`.
- Web: `/admin/torneos` (lista, asistente de 11 pasos, seguimiento con
  pestañas), `/admin/plantillas`, `/app/torneos` (explorar con indicador de
  elegibilidad e inscripción con validación en vivo y reglamento), `/torneos`
  con filtros y `/torneos/[slug]`; torneos en el sitemap.
- E2E: crear → publicar → abrir inscripciones → inscribir → anti-chapulineo →
  aprobar → página pública.

### Changed (m04)
- Los motivos de elegibilidad (`eligibility.reasons`) se redactan en forma
  neutral: el capitán los ve por cada jugador del roster.

### Added (m03 — navegación y vitrina pública)
- `packages/ui`: `PublicHeader` (nav con secciones "Pronto" sin enlace, menú en
  `Sheet` en móvil), `PublicFooter`, `Hero`, `SectionHeading`, `Breadcrumbs`,
  `UserMenu`, variante `showcase` de `EmptyState` y utilidad `hero-grid`.
- `packages/i18n`: textos de la vitrina, legales, 404/error y `plural()`.
- `packages/contracts`: `DirectoryQuerySchema` y listas paginadas públicas de
  equipos y jugadores.
- API: `GET /public/teams` y `GET /public/players` (anónimos, paginados, con
  búsqueda); el directorio de jugadores muestra solo lo que cada jugador hizo
  público.
- Web: layout público con header (lee la sesión en el servidor: invitado,
  usuario o staff) y footer con el disclaimer de Riot; home vitrina con estados
  vacíos; `/torneos`, `/equipos`, `/jugadores`, `/legal`, `/legal/[doc]`
  (preliminares), `/patrocinadores`; 404 y páginas de error con la marca;
  breadcrumbs en equipo y jugador; metadatos y Open Graph por página;
  `sitemap.xml` y `robots.txt`; enlace "Ir al sitio público" en `/app` y
  `/admin`.
- E2E: invitado navega la vitrina y llega a login y registro; usuario con sesión
  llega al portal; staff ve la consola.

### Changed (m03)
- El estado de la API se movió de la home a `/admin`.

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
