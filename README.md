# League App

Plataforma y marca para operar una liga amateur de League of Legends con estética e
identidad tipo LCK/LPL, enfocada en la comunidad hispanohablante.

## Visión

Construir primero una **liga propia** que opere con equipos reales y se sienta
profesional. Validar que los equipos quieren competir. Solo después, extraer el
motor de torneos como un **producto SaaS** vendible a otros organizadores.

> La tecnología reduce el trabajo operativo. Lo que hace que un equipo amateur
> quiera competir es sentirse una estrella: diseño, organización y producción.

## Estado actual

**Módulo 9: Estadísticas y perfiles pro** (de los datos Match-V5 de cada game
salen las stats por jugador y equipo, los agregados por torneo, temporada,
circuito e histórico con el radar de cinco ejes, el meta de campeones, los MVP
y los logros; perfiles de jugador con radar, campeones, evolución, logros,
historial y head-to-head, stats de equipo y de torneo, box score por partida, y
seguir jugadores, equipos y torneos). Antes: módulo 6 (notificaciones in-app y
por correo), módulo 5 (partidas y standings con bracket en vivo), módulo 4
(torneos e inscripciones), módulo 3
(navegación y vitrina pública), módulo 2 (perfiles, cuenta de Riot y
equipos), módulo 1 (motor de torneos en `packages/core`) y módulo 0 (monorepo,
CI, web, API, Supabase, auth y design system). Arquitectura y stack definidos en `docs/`.

## Desarrollo

Requisitos: Node según `.nvmrc` (`nvm use`) y pnpm (la versión exacta se toma de
`packageManager` en `package.json`).

```sh
pnpm install
pnpm dev           # web en http://localhost:3000, API en http://localhost:4000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e      # Playwright (primera vez: pnpm --filter @league/web exec playwright install chromium)
pnpm --filter @league/ui storybook   # Storybook en http://localhost:6006
# Kitchen sink del design system (super_admin, solo en desarrollo): http://localhost:3000/admin/kitchen-sink
pnpm format        # aplica Prettier
```

Base de datos (Supabase, sin Docker en la Mac; proyecto de desarrollo `penta-dev`):

```sh
supabase login
supabase link --project-ref tcxqywnpytfrytpsqiln   # nunca otro proyecto
supabase migration new <nombre>                    # crea supabase/migrations/<ts>_<nombre>.sql
supabase db push                                   # aplica migraciones en penta-dev
pnpm db:types                                      # regenera packages/db/src/database.types.ts
```

Auth en `penta-dev`: el SMTP por defecto de Supabase solo envía correos a
miembros del equipo del proyecto; para registrar otros correos hay que
configurar SMTP propio. Discord requiere `SUPABASE_AUTH_EXTERNAL_DISCORD_CLIENT_ID`
y `..._SECRET` (ver `apps/web/.env.example`) y `supabase config push`.

El seed (`supabase/seed.sql`) solo corre con `supabase db reset` en local/CI; los
tests de RLS (`supabase/tests`) corren en CI con `supabase test db`.

Variables de entorno: copia `apps/api/.env.example` a `apps/api/.env` y
`apps/web/.env.example` a `apps/web/.env.local` (los valores por defecto sirven
para desarrollo local). La API necesita `SUPABASE_SECRET_KEY` (clave secreta de
`penta-dev`, solo del lado servidor): `supabase projects api-keys --reveal`.

Cuenta de Riot: con `RIOT_PROVIDER=stub` (por defecto) la API nunca llama a Riot;
cualquier Riot ID existe (salvo los que empiezan con `missing`) y el ícono
"cambia" en la segunda consulta, así que el flujo de verificación se completa
solo. Con `RIOT_PROVIDER=riot` y `RIOT_API_KEY` usa la API real.

E2E: `pnpm test:e2e` lee `apps/api/.env` y corre los flujos de perfil, Riot,
equipos, invitaciones, torneos (crear → publicar → inscribir → aprobar) y un
torneo relámpago completo (fixtures → check-in → doble reporte → campeón) contra
`penta-dev`, más la notificación de la aprobación en la campana del capitán,
con usuarios y torneos de prueba que crea y borra al terminar (sin
esa variable esos flujos se omiten). La única excepción es la cuenta
`e2e-staff@example.com`: publicar y aprobar quedan en `audit_logs`, que es
append-only, así que esa cuenta se reutiliza entre corridas. En CI corren contra
un Supabase local (`supabase start`).

Torneos: los cambios de estado y las inscripciones escriben eventos de dominio en
`outbox_events` (`tournament.published`, `registration.approved`, …) en la misma
transacción.

Notificaciones: cada `NOTIFICATIONS_POLL_SECONDS` (5 por defecto, `0` lo apaga)
la API toma los eventos pendientes con un lease (`FOR UPDATE SKIP LOCKED`, varias
instancias no chocan), resuelve destinatarios (capitán y roster, ambos equipos,
staff, quienes activaron anuncios), aplica la regla de la organización y las
preferencias (los avisos críticos no se apagan, solo cambian de canal), renderiza
la plantilla es-419 y escribe una notificación in-app más una entrega por canal,
todo idempotente (`source_event_id + user_id + channel`). Los correos salen por
`EmailPort`: con `EMAIL_PROVIDER=fake` (por defecto) se quedan en memoria; con
`resend` necesita `RESEND_API_KEY` y `EMAIL_FROM` (producción no acepta el fake).
Los fallos se reintentan con backoff (30 s, 1 min, 2 min…) y quedan en el monitor
de `/admin/notificaciones/entregas`. Los eventos con más de
`NOTIFICATIONS_MAX_EVENT_AGE_HOURS` (48) se consumen sin avisar. Discord y push
tienen su adaptador registrado pero no disponible.

Estadísticas: al cerrarse una partida (o al llegar los datos de un game) un
trigger la pone en `stats_jobs`; cada `STATS_POLL_SECONDS` (5 por defecto, `0`
lo apaga) la API la toma con lease, deriva las líneas de cada game con
`packages/core` y reescribe en una transacción todo lo que alimenta: agregados
del jugador y del equipo por ámbito, campeones, meta del torneo, MVP de game,
serie, jornada y torneo (este al cerrarse todas sus partidas) y logros (reglas en
`achievements.criteria`, editables en `/admin/logros`). Recalcular es idempotente
(`/admin/torneos/:id` → «Recalcular estadísticas»). Hasta la integración con
Riot (m08) los datos se cargan a mano: en `/admin/torneos/:id/partidas/:matchId`
el staff pega el JSON de Match-V5 de cada game; el ganador debe coincidir con el
resultado registrado y los lados se toman de los PUUID de los rosters. Sin datos,
las páginas muestran solo victorias, derrotas y marcador. Nombres e íconos de
campeones vienen de Data Dragon (`CHAMPIONS_PROVIDER=ddragon`, en caché 12 h;
`static` usa una lista interna, sin red). Seguir a un equipo avisa en la bandeja
cuando se programa su partida; quién sigue a quién solo lo ve cada usuario.

Partidas: la API abre y cierra el check-in sola cada `CHECKIN_SWEEP_SECONDS`
(60 por defecto, `0` lo apaga): al cerrar, quien no hizo check-in pierde por
W.O.; si faltan los dos, la partida queda para el staff. Los resultados se
confirman cuando los dos capitanes reportan lo mismo; si no, la partida queda en
disputa. Todo se escribe con `svc_commit_competition` (una transacción con
standings, auditoría y eventos `match.*` en `outbox_events`). La evidencia va al
bucket privado `match-evidence` y se muestra con URLs firmadas.

Datos de demo (solo `penta-dev`, docs/specs/m0dev): con la API detenida,

```sh
SEED_ENABLED=true pnpm seed:demo    # 54 jugadores, 8 equipos, temporada, circuito y 3 torneos
SEED_ENABLED=true pnpm seed:reset   # borra todo lo marcado demo
```

El seed corre los casos de uso de la API en proceso (mismas validaciones,
auditoría, eventos y standings), así que lo sembrado es indistinguible de lo
real: una Copa Relámpago de 8 equipos con bracket listo para jugar, una Liga de 6
con tres jornadas jugadas (standings con desempates) y un torneo con
inscripciones abiertas (máximo Diamante I: el roster de Jaguares no es elegible).
Se puede correr varias veces sin duplicar; al final imprime los enlaces y las
cuentas (`*@demo.penta.local`, contraseña `SEED_DEMO_PASSWORD` o la de
`apps/api/src/dev/seed/demo-data.ts`). Se niega a correr sin
`SEED_ENABLED=true`, con `NODE_ENV=production`, contra cualquier proyecto que no
sea `penta-dev` o con la API encendida (su barrido de check-in chocaría con las
jornadas pasadas que reproduce). `seed:reset` anonimiza en vez de borrar la
cuenta de staff demo, porque aparece en `audit_logs` (append-only). El código
vive en `apps/api/src/dev` y no entra al build de la API. Al encender la API, el
worker de notificaciones convierte los eventos sembrados en las campanas de las
cuentas demo. En la Liga, el seed también carga datos Match-V5 ficticios en cada
game jugado (con un pentakill) y procesa la cola de estadísticas, así que los
perfiles, la página del torneo y las partidas ya muestran radar, campeones,
líderes, meta y MVP.

Autollenar: con `NEXT_PUBLIC_DEV_TOOLS=true` en `apps/web/.env.local` (y
apuntando a `penta-dev`) el asistente de torneo, el perfil y crear equipo
muestran "Rellenar con datos de ejemplo"; llena el formulario, no lo envía. Sin
la bandera el botón ni siquiera entra al bundle.

Las dependencias se fijan con versión exacta (`savePrefix: ''` en
`pnpm-workspace.yaml`).

## Stack (resumen)

TypeScript en todo · Next.js (sitio + portal PWA + admin) · NestJS (API,
arquitectura hexagonal) · Supabase (Postgres, Auth, Storage, Realtime, CLI) ·
pg-boss (jobs) · discord.js · Electron (agente de observador) · Expo (móvil,
futuro) · Python/FastAPI (procesamiento de imágenes) · n8n (automatizaciones no
críticas) · pnpm + Turborepo. Detalle en `docs/04-arquitectura.md`.

## Documentos

Negocio y producto:

| Documento | Propósito |
|-----------|-----------|
| `docs/00-vision.md` | Visión, propuesta de valor, público, principios, riesgos |
| `docs/01-roadmap.md` | Fases y orden de construcción módulo por módulo |
| `docs/02-formatos-competencia.md` | Formatos, reglas, puntos, Fearless, circuitos |
| `docs/13-reglas-integridad.md` | Elegibilidad, anti-chapulineo, tiers, 1v1/2v2, anti-trampas, validación de resultados |
| `docs/09-monetizacion.md` | Vías de ingreso (siempre al final) |
| `docs/10-legal-cumplimiento.md` | Licencia Riot, disclaimers, privacidad, menores |

Producto y experiencia:

| Documento | Propósito |
|-----------|-----------|
| `docs/14-modulos-funcionales.md` | Inventario completo de módulos: admin, super admin, portal, sitio, evento |
| `docs/12-auth-roles-perfiles.md` | Login, vinculación Riot, perfil, roles y permisos |
| `docs/15-notificaciones.md` | Motor de notificaciones multicanal y configurable |
| `docs/16-media-social-broadcast.md` | Quitar fondo, redes sociales, stream, overlays en vivo |
| `docs/05-plataformas.md` | Superficies: web, PWA, bot, overlays, agente, móvil |
| `docs/08-design-system.md` | Branding, tokens, componentes, estética LCK |
| `docs/11-operaciones.md` | Ciclo de un torneo, roles del staff, disputas |

Técnico:

| Documento | Propósito |
|-----------|-----------|
| `docs/03-modelo-datos.md` | Modelo de datos completo (PostgreSQL) |
| `docs/04-arquitectura.md` | Stack, monorepo, módulos, puertos, orden de construcción |
| `docs/06-riot-integracion.md` | Tournament-V5, Match-V5, verificación, contingencia |
| `docs/07-automatizacion-ia.md` | Flujos por evento, IA (narra y asiste, no decide) |
| `docs/17-estandares-ingenieria.md` | Clean Code, SOLID, patrones, pruebas, definición de terminado |

## Decisiones tomadas

- **Mercado:** México y Latinoamérica. Servidor principal LAN (`LA1`, routing
  regional `americas`); LAS (`LA2`) soportado. Idioma español, moneda MXN,
  zona horaria por defecto `America/Mexico_City`.
- **Edad:** sin edad mínima propia (aplica la de Riot); menores de 18 con
  consentimiento de tutor para competir y para usar su foto.
- **Staff amplio:** streamers, creadores, casters, observers, designers,
  editores, referees y community managers, con roles personalizables.
- **Presupuesto:** sin restricción fuerte; se elige por calidad, no por precio.

## Decisiones abiertas

- Nombre de marca, logo, paleta y tipografías.
- Query layer sobre Supabase (Drizzle o Kysely); migraciones siempre con Supabase CLI.
- Proveedor de API unificada para redes sociales.
- Proveedor de LLM (API) y de moderación de imágenes.

## Herramientas de trabajo

- **Kiro**: planeación, arquitectura y decisiones de diseño de sistema.
- **Claude Code**: implementación (código, integraciones, tests).
- **Git / GitKraken**: control de versiones e historial visual.
