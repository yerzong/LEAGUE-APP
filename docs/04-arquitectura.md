# Arquitectura Técnica

> Documento vivo. Stack elegido según el producto y tus habilidades, estructura
> del monorepo, límites entre módulos y capas de abstracción. Estándares de
> código en `17-estandares-ingenieria.md`.

---

## 1. Decisión de stack (y por qué no usar todo lo que sabes)

Sabes muchas tecnologías. La pregunta no es cuáles conoces, sino **cuáles
reducen el costo de este producto**. El criterio dominante: **un solo lenguaje
(TypeScript) en web, API, bot, overlays, agente y móvil**, para compartir tipos,
validaciones y lógica del dominio. Cada lenguaje extra duplica contratos.

| Pieza | Elección | Por qué |
|-------|----------|---------|
| Web (sitio + portal + admin) | **Next.js (App Router) + React** | SSR para SEO del sitio público, PWA para el portal, una sola app |
| API / dominio | **NestJS** | Módulos, inyección de dependencias y guards: encaja con hexagonal y SOLID |
| Base de datos | **PostgreSQL en Supabase** | Relacional (el dominio lo es), RLS, ya tienes suscripción |
| Auth | **Supabase Auth** | Correo, magic link, Google, Discord, Apple, Twitch, MFA listos |
| Archivos | **Supabase Storage** | Fotos, logos, evidencias, gráficos |
| Tiempo real | **Supabase Realtime** | Marcadores en vivo, overlays, standings |
| Migraciones y entorno local | **Supabase CLI** | Postgres local, migraciones SQL versionadas, tipos generados |
| Colas / jobs | **pg-boss** (sobre Postgres) + patrón outbox | Sin infraestructura extra al inicio; Redis/BullMQ solo si el volumen lo pide |
| Bot | **discord.js** | Estándar |
| Overlays | **React + Vite** | Páginas ligeras para OBS, reusan `packages/ui` |
| Agente de observador | **Electron + Node** | Lee el cliente de LoL en la PC del observador (ver `16`) |
| Móvil (futuro) | **Expo / React Native** | Reutiliza contratos, lógica y hooks |
| Media / IA de imagen | **Python + FastAPI** (microservicio) | Quitar fondo (rembg) y, después, modelos anti-smurf. Python es lo mejor para eso |
| Automatizaciones no críticas | **n8n** | Publicación en redes, reportes, flujos de marketing. Nunca lógica de competencia |
| Diseño | **Figma** (UI, tokens), **Adobe/Blender** (assets de marca, 3D, intros de stream) | |

### Lo que conscientemente NO se usa (y por qué)
| Tecnología | Motivo |
|------------|--------|
| Angular, Vue | Ya hay React en web, overlays y móvil; dos frameworks = dos design systems |
| Spring Boot, Java, .NET, Laravel | Rompen el monorepo de tipos compartidos; NestJS cubre lo mismo en TS |
| Flutter, Android nativo | Expo comparte código con la web; Flutter no |
| MySQL, MongoDB | El dominio es muy relacional (torneos, fases, partidas, rosters); Postgres + jsonb cubre lo flexible |
| Firebase | Supabase cumple ese rol y ya lo pagas |
| **Kafka** | Exceso para este volumen: miles de eventos al día, no millones por segundo. El outbox + pg-boss da garantías suficientes. Se reconsidera si algún día es SaaS a gran escala |

---

## 2. Arquitectura general

```
            ┌──────────── Clientes ────────────────────────────────────┐
            │ Web Next.js (/, /app PWA, /admin) · Móvil Expo (futuro)  │
            │ Overlays OBS · Bot Discord · Agente de observador         │
            └───────┬───────────────────────────────┬──────────────────┘
                    │ HTTPS (REST + contratos Zod)   │ Realtime (suscripción)
                    ▼                                ▼
            ┌───────────────────────┐        ┌───────────────────┐
            │   API NestJS          │        │ Supabase Realtime │
            │   (módulos de negocio)│        └─────────▲─────────┘
            │   ┌───────────────┐   │                  │
            │   │ packages/core │   │   escribe estado │
            │   └───────────────┘   │   en vivo        │
            └──┬────────┬───────────┘──────────────────┘
               │        │ outbox → pg-boss
               │        ▼
               │   ┌───────────────┐      ┌──────────────────────┐
               │   │ Worker (jobs) │─────►│ Media service Python │
               │   └──────┬────────┘      └──────────────────────┘
               │          │ adaptadores
               ▼          ▼
   Supabase Postgres · Storage · Auth      Riot API · Discord · Redes
                                           (unificada / directas) · Correo
                                           · Twitch/YouTube · LLM · n8n
```

Reglas:
- **Toda escritura de negocio pasa por la API** (casos de uso + permisos +
  auditoría). Los clientes no escriben directo a tablas.
- Lecturas públicas y en vivo pueden ir por Supabase con **RLS** (rápido y
  seguro), o por la API cuando haya lógica.
- La API usa la clave de servicio solo del lado servidor; nunca en clientes.

---

## 3. Estructura del monorepo

```
league-app/
├── apps/
│   ├── web/               Next.js — sitio público, portal (PWA), admin
│   ├── api/               NestJS — módulos de negocio, webhooks
│   ├── worker/            Procesador de jobs (puede iniciar dentro de api)
│   ├── bot/               Bot de Discord
│   ├── overlays/          Overlays para OBS
│   ├── observer-agent/    App de escritorio del observador (Electron)
│   ├── media-service/     Python FastAPI: quitar fondo, procesamiento
│   └── mobile/            Expo (futuro)
├── packages/
│   ├── core/              ★ Dominio puro: formatos, standings, desempates,
│   │                        Fearless, elegibilidad, máquinas de estado
│   ├── contracts/         Esquemas Zod + tipos de API (front, back, bot, móvil)
│   ├── db/                Tipos generados, query layer, helpers RLS
│   ├── ui/                Design system (tokens + componentes React)
│   ├── graphics/          Plantillas gráficas + render a imagen (worker y
│   │                        vista previa en admin)
│   ├── integrations/      Puertos y adaptadores: riot, discord, social,
│   │                        email, push, llm, storage, payments
│   ├── i18n/              Textos (español primero)
│   └── config/            ESLint, TS, Tailwind, Vitest compartidos
├── supabase/              Migraciones SQL, seeds, políticas RLS, config CLI
├── n8n/                   Flujos exportados (versionados)
├── docs/
├── pnpm-workspace.yaml · turbo.json · package.json
```

- `pnpm` workspaces + **Turborepo** (cache y tareas solo de lo afectado).
- `apps/media-service` (Python) vive en el monorepo con su propio
  `pyproject.toml`; Turbo lo orquesta igual.

---

## 4. Módulos del backend (NestJS)

Cada módulo sigue la estructura de `17-estandares-ingenieria.md`
(domain / application / infrastructure / presentation).

| Módulo | Responsabilidad |
|--------|-----------------|
| `identity` | Usuarios, perfil, datos privados, consentimientos |
| `riot-accounts` | Vinculación, verificación, snapshots de rango |
| `organizations` | Tenants, miembros, roles, permisos, marca |
| `teams` | Equipos, miembros, invitaciones, agentes libres |
| `seasons-circuits` | Temporadas, circuitos, rankings |
| `tournaments` | Wizard, plantillas, configuración, estados, reglamentos |
| `registrations` | Entrants, rosters, elegibilidad, exclusividad, lista de espera |
| `scheduling` | Fixtures, calendario, reprogramaciones |
| `matches` | Series, partidas, check-in, códigos, resultados, Fearless |
| `standings` | Recalcular tablas y avance de fase (usa `core`) |
| `disputes-integrity` | Disputas, alertas, sanciones, moderación |
| `stats` | Derivar y agregar estadísticas, logros, MVP |
| `notifications` | Motor de notificaciones |
| `media` | Subidas, variantes, quitar fondo, moderación |
| `content` | Noticias, narrativa IA, plantillas gráficas |
| `social` | Cuentas, composer, publicaciones automáticas |
| `broadcast` | Sesiones de producción, overlays, agente, streams |
| `discord` | Vinculación y orquestación del bot |
| `audit` | Registro de auditoría |
| `platform` | Super admin, feature flags, salud del sistema |
| `billing` | Pagos, patrocinios, premios (fase 4) |

---

## 5. Puertos y adaptadores (lo externo nunca toca el dominio)

| Puerto | Adaptadores |
|--------|-------------|
| `TournamentProviderPort` | Riot Tournament-V5 · Riot Stub · Manual |
| `MatchDataPort` | Riot Match-V5 · Manual |
| `RiotAccountPort` | RSO · Verificación por ícono |
| `NotificationChannelPort` | In-app · Correo · Discord · Web Push · Expo Push · (SMS) |
| `SocialPublisherPort` | API unificada · Meta · X · TikTok · YouTube · Discord |
| `StreamStatusPort` | Twitch EventSub · YouTube · Kick |
| `ImageProcessingPort` | Media service (rembg) · API comercial |
| `ContentModerationPort` | Proveedor de visión IA |
| `LlmPort` | Proveedor intercambiable |
| `StoragePort` | Supabase Storage |
| `PaymentPort` | Stripe (fase 4) |

---

## 6. Flujo de eventos (ejemplo: termina una partida)

```
Riot callback → inbound_webhooks (idempotente) → caso de uso FinalizeGame
  en una transacción: games + matches + outbox_events('game.finished')
→ worker:
   ├─ standings.recalculate (core)        ├─ stats.derive / aggregate
   ├─ integrity.verify_participants       ├─ notifications.dispatch
   ├─ graphics.render(result, mvp)        ├─ content.generate_recap (IA, draft)
   └─ social.auto_publish (si está activo y aprobado)
→ Realtime emite cambios → web, overlays y app se actualizan
```

---

## 7. Entornos y despliegue

| Entorno | Base | Uso |
|---------|------|-----|
| `local` | Supabase CLI (Docker) | Desarrollo y tests de integración |
| `staging` | Proyecto Supabase separado | Validación por módulo antes de producción |
| `production` | Proyecto Supabase de producción | Operación real |

- `apps/web` → Vercel.
- `api`, `worker`, `bot`, `media-service` → Railway / Fly.io / Render (contenedores).
- `observer-agent` → instalador para Windows con auto-actualización.
- `n8n` → self-hosted o n8n cloud.
- Secretos en el gestor de cada plataforma; `.env.example` versionado.

---

## 8. Seguridad transversal

- Supabase Auth + MFA para staff; guards de permisos en NestJS; RLS en Postgres.
- Validación con Zod en todos los bordes (API, webhooks, agente, bot).
- Webhooks firmados/verificados e idempotentes.
- Tokens de redes y proveedores en vault, nunca en tablas en claro.
- Rate limiting por usuario e IP; respeto de rate limits de Riot, Discord y redes.
- Datos privados en tabla separada con RLS estricta; nada de PII en logs.
- Auditoría append-only.

---

## 9. Orden de construcción (módulo por módulo, cada uno probado y validado)

| # | Módulo / entrega | Depende de |
|---|------------------|------------|
| 0 | Monorepo, CI, Supabase local, design tokens base, auth | — |
| 1 | `core` (formatos, standings, elegibilidad) con TDD | 0 |
| 2 | Identidad, perfil, organizaciones, roles y permisos | 0 |
| 3 | Vinculación Riot (verificación por ícono) | 2 |
| 4 | Equipos, invitaciones, agentes libres | 2, 3 |
| 5 | Torneos: wizard, plantillas, reglamentos | 1, 2 |
| 6 | Inscripciones, elegibilidad, exclusividad | 4, 5 |
| 7 | Calendario, fixtures, partidas, check-in, reporte manual, disputas | 6 |
| 8 | Standings, avance de fase, sitio público | 7 |
| 9 | Notificaciones (in-app + correo) | 2 |
| 10 | Bot de Discord | 7, 9 |
| 11 | Riot Tournament API (códigos, callbacks, Match-V5) + integridad | 7 |
| 12 | Estadísticas y perfiles con pro-stats | 11 |
| 13 | Media (quitar fondo) y plantillas gráficas | 2 |
| 14 | Redes sociales y seguimiento de stream | 13 |
| 15 | Transmisión: agente de observador + overlays | 11 |
| 16 | Narrativa IA y noticias | 12 |
| 17 | App móvil | 9, 12 |
| 18 | Monetización: pagos, patrocinios, premios | todo |
