# Módulo 05 — Partidas, bracket, resultados y standings

> Spec para Claude Code. Cierra el ciclo del torneo: generar fixtures desde los
> inscritos, jugar las partidas (check-in, reporte de resultado, disputas) y ver
> el bracket y los standings actualizarse. Usa el motor de `packages/core` (ya
> calcula formatos, standings, desempates y avance). Reporte **manual / doble
> reporte** por ahora; Riot Tournament API y códigos van en un módulo posterior.
> Referencias: `docs/02-formatos-competencia.md`, `docs/03-modelo-datos.md §6.3–6.4`,
> `docs/13-reglas-integridad.md §8–9`, `docs/14-modulos-funcionales.md §3.3`.

---

## Alcance

### 1. Migración (Supabase CLI, penta-dev) — `docs/03-modelo-datos.md §6.3–6.4`
- `matches` (serie), `match_officials`, `match_checkins`, `reschedule_requests`.
- `games`, `game_participants`, `draft_actions`, `fearless_locks` (o vista),
  `result_reports`, `disputes`, `dispute_evidence`.
- `standings` y `standing_overrides`.
- RLS en todo; bloqueo optimista (`version`) en `matches`. Regenerar tipos a
  `packages/db`.

### 2. Motor (`packages/core`) — reutilizar
- Generación de fixtures por formato (ya existe `generateMatches`), cálculo de
  standings y avance de fase (ya existe). Si falta pegar piezas (p. ej. tomar los
  entrants aprobados de una fase y producir sus matches), hacerlo en `core`/API
  sin duplicar la lógica de formato.

### 3. API (NestJS) — módulos `scheduling`, `matches`, `standings`
Hexagonal, Zod en `contracts`, permisos, auditoría, eventos de dominio a outbox.
- **Generar fixtures:** al cerrar inscripciones / iniciar una fase, crear los
  `matches` con el seeding elegido (usando `core`). Para brackets, enlazar
  avance ganador/perdedor.
- **Check-in:** abrir/cerrar ventana, registrar check-in por entrant; forfeit
  automático si no hay check-in al cerrar (transición de estado del match).
- **Resultados (doble reporte):** cada capitán reporta ganador y marcador +
  evidencia; si coinciden, se confirma solo; si no, pasa a `disputed`. Un
  referee/staff puede confirmar u override (auditado). Al completar un match:
  recalcular standings (core), avanzar bracket, emitir eventos.
- **Disputas:** abrir, adjuntar evidencia, resolver (staff), con ventana de
  disputa.
- **Reprogramación:** solicitud entre capitanes + aprobación, dentro de las
  ventanas de calendario del torneo.
- **Standings:** endpoint de tabla por fase/grupo, recalculada por el core, con
  el detalle de desempate (para mostrar por qué quedó el orden).

### 4. Web — Admin (`/admin/torneos/[id]`)
Activar las pestañas que en el módulo 04 quedaron como "siguiente entrega":
- **Fases/Bracket:** generar fixtures, ver y editar el bracket/calendario.
- **Calendario:** asignar horarios a las partidas dentro de las ventanas.
- **Partidas:** lista y detalle; ver check-in, confirmar/override resultado,
  resolver disputas, reprogramar. Todo con confirmación y motivo en lo sensible.
- **Standings:** tabla en vivo con el detalle de desempate.

### 5. Web — Portal del jugador (`/app`)
- **Centro de partida:** próximas partidas del equipo, check-in, reportar
  resultado (subir evidencia), solicitar reprogramación, abrir disputa.
- **Mi calendario:** próximas partidas propias.

### 6. Web — Público (`/torneos/[slug]`)
- **Bracket** visual (single/double elim) y **tabla de grupos/round robin** en
  vivo.
- **Calendario** de partidas y **resultados**.
- **Detalle de partida:** marcador por game, participantes; (draft y stats
  detalladas llegan con la integración de Riot).

### 7. Tiempo real (Supabase Realtime)
- Standings y estado de partidas se actualizan en vivo en las páginas públicas y
  en el centro de partida, sin recargar.

---

## Lo que NO va en este módulo
- Riot Tournament API, generación de códigos de partida, lectura automática de
  resultados (módulo de integración Riot).
- Overlays de transmisión y agente de observador (módulo de broadcast).
- Stats detalladas por jugador y pro-stats (módulo de estadísticas).
- Notificaciones por Discord/correo (solo emitir eventos de dominio).
- Fearless aplicado al draft en vivo (el motor ya calcula los bloqueos; su uso en
  vivo llega con la integración de partida/Riot).

## Criterios de aceptación
- [ ] `supabase db push` aplica la migración; RLS con tests.
- [ ] Desde un torneo con inscritos aprobados, el staff genera los fixtures
      correctos para eliminación simple y para round robin.
- [ ] Flujo de partida: check-in de ambos → reporte de ambos capitanes → si
      coinciden, se confirma; si no, queda en disputa; staff resuelve.
- [ ] Forfeit automático al cerrar check-in sin presencia de un equipo.
- [ ] Al completar partidas, los standings se recalculan solos y el bracket
      avanza; el orden muestra su criterio de desempate.
- [ ] Las páginas públicas muestran bracket y tabla, y se actualizan en vivo.
- [ ] `pnpm lint typecheck test build` pasa; E2E de un torneo relámpago corrido
      de principio a fin (crear→inscribir→aprobar→fixtures→jugar→campeón) contra
      penta-dev, limpiando sus datos.
- [ ] Toda la UI con `packages/ui` e i18n; sin hex ni estilos sueltos.

## Notas
- **Meta del módulo:** poder correr un **relámpago de 8 equipos de principio a
  fin** en la plataforma, con reporte manual. Ese es el hito del piloto.
- Priorizar eliminación simple y round robin (lo del piloto); doble elim y suizo
  deben funcionar pero probar a fondo esos dos.
- Reutilizar al máximo `packages/core`; la API orquesta y persiste, el core
  decide.
