# Arquitectura Técnica — League App

> Documento vivo. El "cómo" técnico, justificado por la planeación previa. Define
> stack, estructura de monorepo, límites entre dominios y las capas de abstracción
> que protegen al sistema de dependencias externas (Riot, pagos).

---

## 1. Principios de arquitectura

1. **Dominio aislado del detalle.** El core de torneos (reglas, formatos, cálculo
   de standings) no depende de frameworks, base de datos concreta ni APIs externas.
   Arquitectura hexagonal / puertos y adaptadores.
2. **Todo lo externo va detrás de un puerto.** Riot, Stripe, Discord, el motor de
   renderizado y el LLM son adaptadores intercambiables. Si Riot tarda o se cae, el
   resto opera.
3. **Multi-tenant por diseño.** La organización es la frontera de datos y permisos.
4. **Monorepo con paquetes compartidos** para no duplicar tipos ni lógica entre
   web, API, bot y overlays.
5. **Tipado de punta a punta.** TypeScript en todo; los tipos del dominio son la
   fuente de verdad compartida.
6. **Observabilidad y auditoría** como ciudadanos de primera clase (logs, trazas,
   AuditLog del modelo de datos).

---

## 2. Stack recomendado (justificado)

| Capa | Elección | Por qué |
|------|----------|---------|
| Lenguaje | **TypeScript** | Full-stack, tipos compartidos entre front y back |
| Runtime | **Node.js (LTS)** | Ecosistema, compatibilidad con libs de Riot/Discord |
| Gestor monorepo | **pnpm workspaces + Turborepo** | Instala rápido, cachea builds, orquesta tareas entre apps |
| Web | **Next.js (App Router)** | SSR/ISR para páginas públicas SEO + PWA + dashboard |
| UI | **React + Tailwind + design system propio** | Estética LCK, componentes reutilizables |
| API | **NestJS** o **tRPC + Fastify** | NestJS si se quiere estructura modular fuerte; tRPC si se prioriza tipado extremo front-back |
| Base de datos | **PostgreSQL** | Relacional, JSONB para configs flexibles, robusto |
| ORM | **Prisma** o **Drizzle** | Tipado, migraciones versionadas |
| Cache / colas | **Redis** | Cache de stats, colas de jobs de automatización |
| Jobs / eventos | **BullMQ (sobre Redis)** | Procesar webhooks, recalcular standings, generar gráficos |
| Bot | **discord.js** | Estándar maduro para bots de Discord |
| Realtime | **WebSockets (Socket.IO)** o **SSE** | Overlays en vivo, actualizaciones de marcador |
| Render gráficos | **Satori / Puppeteer / node-canvas** | HTML/componente → imagen para piezas estilo LCK |
| IA / narrativa | **Adaptador LLM** (proveedor intercambiable) | Resúmenes y notas de prensa |
| Pagos | **Stripe** (detrás de puerto) | Suscripciones y pagos maduros |
| Auth | **Auth propio + OAuth (Discord) + RSO (Riot)** | RSO para verificación de cuenta |

> Estas son recomendaciones fundamentadas, no dogma. La decisión final de
> NestJS vs tRPC y Prisma vs Drizzle se toma al iniciar el Bloque de construcción.

---

## 3. Estructura del monorepo

> El monorepo nace cuando empieza la construcción (Fase 1–2), no ahora. Esta es la
> estructura objetivo que la planeación justifica.

```
league-app/
├── apps/
│   ├── web/              Next.js — sitio público + dashboard de admin + PWA
│   ├── api/              Backend — API, webhooks, auth, orquestación
│   ├── bot/              Bot de Discord (check-in, avisos, códigos)
│   ├── overlays/         Fuentes de navegador para OBS (picks&bans, lower-thirds)
│   └── worker/           Procesador de jobs (BullMQ): stats, gráficos, narrativa
│
├── packages/
│   ├── core/             ★ Motor de torneos AISLADO (dominio puro, sin frameworks)
│   │                       reglas, formatos, cálculo de standings, Fearless
│   ├── db/               Esquema, migraciones, cliente (Prisma/Drizzle)
│   ├── types/            Tipos/contratos compartidos (DTOs, enums del dominio)
│   ├── ui/               Design system: componentes React + tokens
│   ├── config/           ESLint, TS, Tailwind, tsconfig compartidos
│   ├── riot/             Adaptador Riot (Tournament-V5, Match-V5) tras puerto
│   ├── payments/         Adaptador de pagos (Stripe) tras puerto
│   ├── ai/               Adaptador LLM (narrativa) tras puerto
│   └── graphics/         Motor de render de plantillas → imagen
│
├── docs/                 ◄ Planeación (lo que estamos haciendo ahora)
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── .gitignore
```

### La pieza clave: `packages/core`
Es el corazón del negocio y del SaaS futuro. Contiene las reglas de competencia
como **lógica pura**: dado un torneo, sus fases y resultados, calcula standings,
valida Fearless, determina avances y desempates. **No importa Prisma, ni Express,
ni la API de Riot.** Recibe datos, devuelve decisiones. Por eso es testeable al
100% y empaquetable como producto.

---

## 4. Arquitectura hexagonal (puertos y adaptadores)

```
                    ┌─────────────────────────────┐
                    │      packages/core          │
   Puertos  ◄──────►│   (dominio de torneos puro) │◄──────►  Puertos
   (entrada)        │   reglas · standings · draft│       (salida)
                    └─────────────────────────────┘
        ▲                                                   │
        │                                                   ▼
┌───────────────┐                              ┌────────────────────────┐
│  Adaptadores  │                              │     Adaptadores de      │
│  de entrada   │                              │        salida           │
│ ------------- │                              │ ----------------------- │
│ API REST/tRPC │                              │ RiotAdapter (V5)        │
│ Bot Discord   │                              │ PaymentAdapter (Stripe) │
│ Jobs/webhooks │                              │ Repo DB (Prisma)        │
└───────────────┘                              │ LLMAdapter / Graphics   │
                                               │ DiscordAdapter          │
                                               └────────────────────────┘
```

Beneficio concreto: cuando la Production API Key de Riot tarde, el `RiotAdapter`
se reemplaza por un `ManualAdapter` (registro de resultados a mano) **sin tocar el
core ni la web.** La liga opera igual.

---

## 5. Flujo de datos (ejemplo: cierre de una partida)

```
1. Partida termina
   ├─ Con Riot (Fase 2): webhook Match-V5 → apps/api recibe JSON
   └─ Sin Riot (piloto): admin registra resultado en apps/web
2. apps/api valida y persiste Game + raw_payload (packages/db)
3. Encola jobs (BullMQ) en apps/worker:
   ├─ Recalcular Standing (packages/core)
   ├─ Derivar PlayerMatchStats y agregados
   ├─ Generar GraphicRender (packages/graphics) → MediaAsset
   └─ Generar MatchNarrative (packages/ai)
4. apps/worker publica:
   ├─ Actualiza web (standings, perfiles)
   ├─ Empuja a overlays vía WebSocket
   └─ Notifica en Discord (apps/bot)
```

Todo disparado por eventos, sin intervención humana una vez configurado.

---

## 6. Entornos y despliegue

| Entorno | Propósito |
|---------|-----------|
| `local` | Desarrollo (Docker Compose: Postgres + Redis) |
| `staging` | Pruebas de integración, pre-torneo |
| `production` | Operación real |

Opciones de hosting (decidir al construir):
- **Vercel** para `apps/web` (Next.js nativo).
- **Railway / Render / Fly.io** para `api`, `bot`, `worker`.
- **Postgres gestionado** (Supabase, Neon, Railway) + **Redis gestionado**.
- Contenedores Docker para portabilidad.

Secretos en gestor dedicado (no en el repo); `.env.example` versionado como guía.

---

## 7. Seguridad transversal

- Autenticación con sesiones/JWT; RSO para verificar cuentas Riot.
- Autorización **por organización y rol** (multi-tenant).
- Validación de entrada en los bordes (schemas: Zod).
- Rate limiting en la API y respeto a los rate limits de Riot.
- Secretos cifrados; nunca PII ni tokens en logs.
- AuditLog para acciones sensibles (disputas, overrides de resultado).

---

## 8. Estrategia de pruebas

- **`packages/core`: cobertura alta con tests unitarios.** Es lógica pura, es
  barato y crítico testearla (standings, Fearless, desempates).
- Tests de integración para adaptadores (Riot, pagos) con mocks/stubs (Riot
  ofrece Tournament-Stub para probar sin partidas reales).
- Tests e2e de los flujos críticos (inscripción, reporte de resultado).
- CI en cada push (lint + typecheck + test + build) vía Turborepo.

---

## 9. Qué se construye primero (orden técnico, sin recortar la visión)

El producto es completo; el orden de construcción respeta dependencias:

1. `packages/db` + `packages/core` + `packages/types` — el cimiento del dominio.
2. `apps/api` + `apps/web` (dashboard de admin + páginas públicas) — operar torneos.
3. `apps/bot` — reducir trabajo de coordinación.
4. `packages/riot` + `apps/worker` — automatización con Riot (tras Production Key).
5. `apps/overlays` + `packages/graphics` + `packages/ai` — el efecto LCK.

Cada pieza se entrega **terminada**, no a medias. El torneo piloto corre sobre
(1)+(2) ya completos y alimenta con datos reales el diseño fino de (4) y (5).
