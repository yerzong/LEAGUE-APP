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

| Documento | Propósito |
|-----------|-----------|
| `docs/01-roadmap.md` | Hoja de ruta por fases: qué construir y qué NO todavía |
| `docs/02-formatos-competencia.md` | Formatos, reglas, sistema de puntos (pendiente) |
| `docs/03-modelo-datos.md` | Modelo de datos multi-torneo (pendiente) |

## Herramientas de trabajo

- **Kiro** — planeación, arquitectura y decisiones de diseño de sistema.
- **Claude Code** — implementación pesada (código, integraciones, tests).
- **Git / GitKraken** — control de versiones e historial visual.
