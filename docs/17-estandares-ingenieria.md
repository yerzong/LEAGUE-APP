# Estándares de Ingeniería

> Documento vivo. Cómo se escribe el código: Clean Code, SOLID, modular y
> genérico. Es el contrato que Claude Code (y cualquier dev) debe seguir.

---

## 1. Principios

- **Clean Architecture / Hexagonal**: el dominio no conoce frameworks, base de
  datos ni APIs externas. Las dependencias apuntan hacia adentro.
- **SOLID**:
  - *S* — una clase/módulo, una razón para cambiar (un caso de uso por clase).
  - *O* — formatos de torneo, reglas de elegibilidad, canales de notificación y
    adaptadores se **agregan** sin modificar el código existente (estrategias).
  - *L* — todo adaptador de un puerto es intercambiable (Riot real / stub / manual).
  - *I* — puertos pequeños y específicos (`MatchDataPort`, no un `RiotService`
    gigante).
  - *D* — los casos de uso dependen de interfaces, inyectadas por NestJS.
- **Screaming Architecture**: las carpetas gritan el negocio (`tournaments`,
  `registrations`, `matches`), no la técnica (`controllers`, `services`).
- **Genérico donde hay repetición real**, no especulativo. Regla de tres: se
  abstrae a la tercera repetición.
- **Composición sobre herencia.**

---

## 2. Patrones clave del dominio

| Necesidad | Patrón |
|-----------|--------|
| Formatos de fase (round robin, single/double elim, suizo, grupos) | **Strategy** (`PhaseFormatStrategy`: generar fixtures, calcular standings, determinar avance) + registro de estrategias |
| Reglas de elegibilidad | **Specification** (cada regla es una especificación componible) |
| Desempates | **Chain of Responsibility** (criterios en orden) |
| Integraciones externas | **Puertos y adaptadores** |
| Ciclo de vida de torneo y partida | **Máquina de estados** explícita (transiciones válidas, guards) |
| Reacciones a lo que pasa | **Eventos de dominio** + outbox transaccional |
| Notificaciones | **Observer** vía eventos + adaptadores por canal |
| Creación desde plantilla | **Builder / Factory** |

---

## 3. Estructura de un módulo de backend (NestJS)

```
apps/api/src/modules/registrations/
├── domain/                 entidades, value objects, reglas, eventos (sin Nest)
├── application/            casos de uso (RegisterTeamUseCase), puertos
├── infrastructure/         repositorios (Postgres), adaptadores externos
├── presentation/           controllers, DTOs, validación (Zod)
└── registrations.module.ts
```
- La lógica de competencia pura vive en `packages/core` y se reutiliza.
- Un módulo no importa la `infrastructure` de otro módulo: se comunica por su
  API de aplicación o por eventos.

## 4. Frontend

- **Feature-based**: `features/tournaments/{components,hooks,api,schemas}`.
- **Container / Presentational**: los presentacionales no hacen fetch (se
  reutilizan en overlays, gráficos y móvil).
- **Atomic design** en `packages/ui`.
- Estado del servidor con **TanStack Query**; estado de UI local mínimo.
- Formularios con **React Hook Form + Zod** (los mismos esquemas que el backend,
  desde `packages/contracts`).
- Componentes genéricos obligatorios: DataTable, ConfirmDialog, Toast, Wizard,
  FormField, Uploader, EmptyState, ErrorState, Skeleton.

---

## 5. Contratos y tipos compartidos

- `packages/contracts`: esquemas Zod de requests/responses → tipos TS
  inferidos para web, móvil, bot y overlays. **Una sola fuente de verdad.**
- Tipos de base de datos generados (Supabase CLI / ORM), nunca escritos a mano.
- OpenAPI generado desde la API para documentación.

---

## 6. Pruebas (cada módulo se programa, prueba y valida)

| Nivel | Qué | Herramienta |
|-------|-----|-------------|
| Unitarias | `packages/core` (formatos, standings, desempates, Fearless, elegibilidad) con cobertura alta | Vitest |
| Integración | Casos de uso con Postgres real (Supabase local) | Vitest + Supabase CLI |
| Contrato | Adaptadores Riot (Tournament-Stub), redes, Discord | Vitest + mocks |
| E2E | Flujos críticos: registro, crear equipo, inscribir, check-in, reportar resultado | Playwright |
| Componentes | `packages/ui` | Storybook + Testing Library |

- **TDD** para la lógica de dominio (RED → GREEN → REFACTOR).
- Los tests de `core` no tocan red ni base de datos.

### Definición de terminado (por módulo)
- [ ] Especificación del módulo escrita (qué hace, criterios de aceptación).
- [ ] Lógica de dominio con tests.
- [ ] API con validación, permisos y auditoría donde aplique.
- [ ] UI con estados de carga/vacío/error y confirmaciones.
- [ ] E2E del flujo principal.
- [ ] Lint, typecheck, tests y build en verde en CI.
- [ ] Documentación actualizada (docs + CHANGELOG).
- [ ] Revisado y probado en staging.

---

## 7. Calidad y convenciones

- TypeScript `strict`. Sin `any` salvo justificado.
- ESLint + Prettier compartidos (`packages/config`).
- Nombres en **inglés** en código; textos de UI vía i18n (español primero).
- Errores tipados del dominio → respuestas HTTP consistentes (problem+json).
- Sin lógica de negocio en controllers ni en componentes.
- Feature flags para liberar módulos gradualmente.
- **Nombre y marca nunca hardcodeados**: el nombre, logo, colores y textos de
  marca salen de la configuración de la organización (`organizations`,
  `brand_themes`, i18n). Cambiar de nombre debe ser configuración, no código.

## 8. Git

- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- Rama por módulo/feature, PR pequeño (< 400 líneas; si no, PRs encadenados).
- CI en cada PR: lint + typecheck + test + build (Turborepo, solo lo afectado).
- `main` siempre desplegable.

## 9. Observabilidad y operación

- Logs estructurados con correlation id por request/evento.
- Errores a Sentry (o equivalente).
- Métricas de jobs y colas visibles en el módulo de salud del sistema.
- Migraciones versionadas (Supabase CLI) y revisadas en PR.
- Backups automáticos de Postgres (Supabase) y prueba periódica de restauración.
