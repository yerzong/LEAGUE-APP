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

**Fase 0: Planeación y diseño.** Arquitectura y stack definidos en `docs/`.
Todavía no hay código. El monorepo se crea en el módulo 0 de construcción.

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
