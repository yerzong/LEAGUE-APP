# Módulo 04 — Crear torneos e inscripciones

> Spec para Claude Code. Conecta el motor (`packages/core`) con pantallas reales:
> un admin crea un torneo con todos sus parámetros y lo publica; los equipos se
> inscriben con validación de elegibilidad y anti-chapulineo. Debe quedar
> **completo y usable**: crear → publicar → inscribir → aprobar → ver
> participantes. Partidas, bracket en vivo y standings van en el módulo siguiente.
> Referencias: `docs/02-formatos-competencia.md`, `docs/03-modelo-datos.md §5–6.2`,
> `docs/13-reglas-integridad.md`, `docs/14-modulos-funcionales.md §3`.
> Estándares: `docs/17-estandares-ingenieria.md`.

---

## Alcance

### 1. Migración (Supabase CLI, penta-dev) — `docs/03-modelo-datos.md §5–6.2`
- `seasons`, `circuits`, `circuit_tournaments`.
- `tournaments` (con todos los campos: tipo, tier, estado, visibilidad,
  elegibilidad por referencia, modalidad online/onsite/hybrid, co-stream,
  supervisión, premios flag…), `tournament_game_settings`,
  `tournament_roster_rules`, `eligibility_rules`, `rulebooks`,
  `rulebook_versions`, `tournament_staff`, `tournament_prizes`,
  `prize_deliveries`, `tournament_templates`.
- `entrants`, `entrant_roster_members` (con el índice parcial de exclusividad),
  `roster_change_requests`.
- `phases`, `groups`, `phase_entrants` (estructura; se poblará al generar
  fixtures en el módulo siguiente).
- RLS en todo; índices de `§15–16` relevantes (sobre todo exclusividad e
  inscripción única por torneo). Regenerar tipos a `packages/db`.

### 2. Motor (`packages/core`) — usar lo que ya existe
- Usar el motor de elegibilidad y la exclusividad ya construidos para validar
  inscripciones. Si falta algún helper puro (p. ej. resumir qué reglas aplican a
  un torneo), agregarlo en `core` con TDD. No duplicar lógica en la API.

### 3. API (NestJS) — módulos `tournaments` y `registrations`
Estructura hexagonal, Zod en `packages/contracts`, permisos, auditoría.
- **Torneos:** crear (borrador), actualizar, publicar (con las reglas de edición
  por estado de `§3.2` del doc 14), listar, ver detalle, archivar/cancelar.
  Guardar como plantilla y clonar desde plantilla. Al publicar: generar la
  estructura de fases/grupos vacía según el formato (sin fixtures aún).
- **Reglamentos:** crear versión, publicar versión; al inscribirse se registra la
  versión aceptada.
- **Inscripciones:** un equipo (o jugador solo) se inscribe; la API evalúa
  elegibilidad y exclusividad con `core` y devuelve el detalle por regla/jugador;
  estados pending/approved/rejected/waitlisted/withdrawn. Aprobar/rechazar (staff)
  con motivo. Lista de espera con orden. Seeding manual/aleatorio/por rango.
- Todas las escrituras por la API; acciones sensibles (publicar, aprobar,
  rechazar, cancelar) en `audit_logs`.

### 4. Web — Admin (`/admin`)
- **Wizard de creación** (`docs/14 §3.1`), pasos: básico → participantes
  (independientes/clubes/mixto, modalidad) → modo de juego (5v5/2v2/1v1, mapa,
  pick) → elegibilidad (constructor de reglas) → roster → formato (fases,
  Bo1/Bo3/Bo5, draft, puntos, desempates, clasificados) → calendario (ventanas)
  → supervisión → comunicación (placeholder, se conecta en módulo notif) →
  premios (opcional) → revisión y publicar. Guardable como borrador en cualquier
  paso. Vista previa del bracket/estructura antes de publicar.
- **Página de seguimiento del evento** (`docs/14 §3.3`), pestañas que apliquen a
  esta fase: Resumen, Inscripciones (aprobar/rechazar con elegibilidad por
  jugador y motivo de falla), Participantes (rosters), Configuración (editable
  según estado), Auditoría. Las pestañas de Fases/Calendario/Partidas/Standings
  pueden existir como estructura con estado "disponible en la siguiente entrega".
- **Lista de torneos** y **plantillas**.

### 5. Web — Portal del jugador (`/app`) y público
- **Explorar torneos** (`/app`): con indicador "eres elegible / no por X" por
  torneo, calculado con `core`.
- **Inscripción**: elegir equipo y roster, ver validación en vivo (quién no es
  elegible y por qué), aceptar reglamento, enviar. (Pago queda fuera; si el
  torneo tuviera fee, marcar "pago pendiente" sin cobrar aún.)
- **Público** (`/torneos` y `/torneos/[slug]`): reemplazar el estado vacío del
  módulo 03 por el listado real y la página de detalle del torneo (info,
  reglamento, participantes, formato). Bracket/standings en vivo: módulo
  siguiente.

---

## Lo que NO va en este módulo
- Generación de fixtures, bracket jugable, check-in, resultados, standings en
  vivo (módulo 05).
- Pagos reales (solo marcar estado).
- Bot de Discord, notificaciones por canal (se conectan después; dejar los
  eventos de dominio emitidos para engancharlos luego).
- Riot Tournament API / códigos de partida.

## Criterios de aceptación
- [ ] `supabase db push` aplica la migración; RLS con tests (un equipo no ve
      inscripciones de otro torneo; solo staff aprueba).
- [ ] Un admin crea un torneo con el wizard, lo guarda como borrador, lo edita y
      lo publica; al publicar se crean las fases/grupos vacíos correctos para el
      formato elegido.
- [ ] Un capitán ve el torneo en "Explorar", su equipo marcado elegible/no
      elegible con el motivo, y puede inscribirse eligiendo roster.
- [ ] La exclusividad bloquea de verdad: un jugador en dos inscripciones del
      mismo ámbito es rechazado por la BD y por `core`, con mensaje claro.
- [ ] Staff aprueba/rechaza inscripciones; los cambios quedan en auditoría.
- [ ] `/torneos` público lista torneos reales y el detalle se ve completo.
- [ ] `pnpm lint typecheck test build` pasa; E2E del flujo completo
      crear→publicar→inscribir→aprobar contra penta-dev, creando y limpiando sus
      datos.
- [ ] Toda la UI con `packages/ui` e i18n; sin hex ni estilos sueltos.

## Notas
- "Completo" aquí significa: el ciclo crear→inscribir→aprobar funciona de punta a
  punta y se puede demostrar en el navegador. Lo que queda fuera (partidas) es un
  módulo aparte, no una parte a medias de este.
- Priorizar los formatos del piloto (relámpago: eliminación simple; liga: round
  robin). El wizard debe soportar todos, pero probar a fondo esos dos.
- Emitir eventos de dominio (`tournament.published`, `registration.approved`…) a
  `outbox_events` aunque todavía nadie los consuma; así el módulo de
  notificaciones solo se engancha, no se reescribe.
