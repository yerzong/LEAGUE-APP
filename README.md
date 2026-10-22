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

**Fase: Planeación.** Todavía NO hay arquitectura técnica decidida ni código.
La estructura técnica (monorepo, apps, paquetes) nacerá cuando la planeación lo
justifique, no antes.

## Estructura

```
league-app/
├── docs/        Documentos de planeación (el trabajo actual)
└── README.md    Este archivo
```

## Documentos de planeación

Bloque A — Negocio y producto:

| Documento | Propósito | Estado |
|-----------|-----------|--------|
| `docs/00-vision.md` | Visión, propuesta de valor, público, principios | ✅ |
| `docs/01-roadmap.md` | Hoja de ruta por fases: qué construir y qué NO todavía | ✅ |
| `docs/02-formatos-competencia.md` | Formatos, reglas, sistema de puntos | ✅ |
| `docs/09-monetizacion.md` | Vías de ingreso, patrocinios, SaaS futuro | ✅ |
| `docs/10-legal-cumplimiento.md` | Licencia Riot, disclaimers, privacidad | ✅ |

Bloque B — Técnico:

| Documento | Propósito | Estado |
|-----------|-----------|--------|
| `docs/03-modelo-datos.md` | Entidades multi-torneo y relaciones | ✅ |
| `docs/04-arquitectura.md` | Stack, monorepo, apps/packages, capa anti-Riot | ✅ |
| `docs/05-plataformas.md` | Web, PWA, mobile, bot Discord, overlays | ✅ |
| `docs/06-riot-integracion.md` | Tournament-V5, Match-V5, abstracción | ✅ |
| `docs/07-automatizacion-ia.md` | Flujos automáticos, agentes IA, narrativa | ✅ |

Bloque C — Experiencia y operación (después):

| Documento | Propósito | Estado |
|-----------|-----------|--------|
| `docs/08-design-system.md` | Branding, tokens, componentes, estética LCK | ⏳ |
| `docs/11-operaciones.md` | Flujo de un torneo end-to-end, roles, soporte | ⏳ |

## Herramientas de trabajo

- **Kiro** — planeación, arquitectura y decisiones de diseño de sistema.
- **Claude Code** — implementación pesada (código, integraciones, tests).
- **Git / GitKraken** — control de versiones e historial visual.
