# @league/core — motor de torneos

Lógica de competencia **pura**: entra un estado, sale una decisión. Sin
frameworks, base de datos, red ni React (ver `package.json`: solo dependencias
de desarrollo). Todo es determinista y se prueba con Vitest al ≥ 90 %
(`pnpm --filter @league/core test` falla si la cobertura baja de 95/90/95/95 en
statements/branches/functions/lines).

Reglas de negocio: `docs/02-formatos-competencia.md` y
`docs/13-reglas-integridad.md`. Spec: `docs/specs/m01-core-engine.md`.

| Área | Módulo | Patrón |
|------|--------|--------|
| Series Bo1/Bo3/Bo5 | `series/` | — |
| Puntos y desempates | `standings/` | Chain of Responsibility |
| Formatos de fase | `formats/` | Strategy + registro |
| Fearless Draft | `fearless/` | — |
| Elegibilidad | `eligibility/` | Specification |
| Ciclos de vida | `lifecycle/` | Máquina de estados |

Los errores son clases tipadas (`DomainError` con `code`): `InvalidSeriesError`,
`InvalidEntrantsError`, `InvalidFormatConfigError`, `UnknownFormatError`,
`MatchNotFoundError`, `InvalidMatchResultError`, `BracketConflictError`,
`RoundInProgressError`, `UnknownEligibilityRuleError`,
`InvalidEligibilityRuleError`, `IneligibleEntrantError`,
`InvalidTransitionError`, `TransitionGuardError`. El campo `details.reason`
dice qué falló; los mensajes son para logs, nunca para la UI.

> Los ejemplos de este README se ejecutan en `src/public-api.test.ts`.

## Tipos del dominio

`Entrant` (`id`, `seed`), `Match` (serie entre dos entrants: `round`,
`position`, `groupId`, `bracketSide`, `entrantA/B`, `sourceA/B`,
`nextWinner`, `nextLoser`, `seriesFormat`, `status`, `result`), `Game`,
`DraftPick`, `ChampionId`, `Side`, `SeriesFormat`, `MatchStatus`, `GameStatus`.
Los `id` de las series son claves estables dentro de la fase (`r1-m2`,
`u-r2-m1`, `l-r3-m1`, `gf-1`, `g1-r1-m1`, `third-place`); la API las asocia a
sus filas.

## Series

```ts
import { resolveSeries } from '@league/core';

resolveSeries({
  format: 'bo3',
  entrantA: 'aurora',
  entrantB: 'basalto',
  games: [
    { number: 1, status: 'completed', blue: 'aurora', red: 'basalto', winner: 'aurora' },
    { number: 2, status: 'completed', blue: 'basalto', red: 'aurora', winner: 'aurora' },
  ],
});
// → { scoreA: 2, scoreB: 0, isComplete: true, winner: 'aurora' }
```

Ignora remakes y partidas sin terminar (un remake se juega con el siguiente
número). Lanza `InvalidSeriesError` si hay una partida después de decidida la
serie, un ganador ajeno, números repetidos o lados que no son los dos entrants.

## Puntos y desempates

- `PointsRule`: `{ win, loss, draw, bonus? }`. Bonus: `per_game_won`,
  `clean_sweep`, `forfeit_loss`. Default (docs/02 §4.4): 3/0/1.
- `TiebreakRule`: lista ordenada de criterios para los empatados en puntos:
  `head_to_head`, `head_to_head_game_diff`, `game_diff`, `game_wins`, `wins`,
  `buchholz`, `tiebreaker_match`.
- Cada criterio separa al grupo o **cede al siguiente**. Los que siguen
  empatados vuelven a empezar la cadena **entre ellos** (el head-to-head se
  recalcula solo con ellos).
- Cada `Standing` trae `tiebreaks` (qué criterio lo separó, con qué valor y de
  quiénes) para mostrar "por qué" en la web, y `tiedWith` si nada lo separó
  (comparten lugar → `requiresManualTiebreak(standings)` es `true`).
- Las series marcadas `isTiebreaker` no suman puntos; solo cuentan para
  `tiebreaker_match`.

## Formatos de fase

```ts
import { createFormatRegistry, DEFAULT_POINTS_RULE } from '@league/core';

const registry = createFormatRegistry();
const season = registry.get('round_robin'); // o registry.get(phase.format) con el valor de la BD

let matches = season.generateMatches(teams, { seriesFormat: 'bo3' });
matches = season.onMatchCompleted(matches, { ...matches[0], status: 'completed', result });
const standings = season.computeStandings(matches, DEFAULT_POINTS_RULE, ['head_to_head', 'game_diff']);
season.resolveAdvancement(standings, { count: 4 });
// → { status: 'resolved', advancing, eliminated }
//   o { status: 'requires_tiebreaker', advancing, eliminated, tiedAtCutoff, openSlots }
season.isComplete(matches, { seriesFormat: 'bo3' });
```

Todas las estrategias implementan `PhaseFormatStrategy` (`generateMatches`,
`computeStandings`, `resolveAdvancement`, `onMatchCompleted`, `isComplete`) y
validan su `config` en tiempo de ejecución (viene de jsonb).

| `format` | Config | Notas |
|----------|--------|-------|
| `round_robin` / `double_round_robin` | `seriesFormat` | Método del círculo; con número impar, un descanso por ronda. La segunda vuelta invierte los lados. |
| `groups` | `seriesFormat`, `groupCount`, `legs?` | Reparto en serpiente por seed. `advancement.count` es por grupo; avanzan 1A, 1B, 2A, 2B… |
| `single_elimination` | `seriesFormat`, `finalSeriesFormat?`, `thirdPlaceMatch?` | Seeding estándar (1v8, 4v5…). Los byes van a los mejores seeds y se resuelven al generar: esas series no existen y el entrant aparece directo en la ronda 2. |
| `double_elimination` | `seriesFormat`, `finalSeriesFormat?`, `grandFinalReset?` | Upper y lower bracket (los perdedores bajan en orden inverso para retrasar revanchas), gran final y reset opcional (`gf-2` se cancela si gana el finalista del upper). |
| `swiss` | `seriesFormat`, `rounds`, `winsToAdvance?`, `lossesToEliminate?` | `generateMatches` devuelve la ronda 1; cada ronda siguiente con `pairNextSwissRound(entrants, matches, config)`. |

- **Brackets**: `onMatchCompleted` mueve ganador y perdedor a sus siguientes
  series. Corregir un resultado se permite mientras la siguiente serie no haya
  empezado; si ya empezó, `BracketConflictError`.
- **Posiciones en brackets**: por la ronda a la que llegó cada entrant; los
  eliminados en la misma ronda comparten lugar (5.º–8.º). En ese caso no se pide
  tiebreaker, salvo que el corte de clasificación caiga dentro.
- **Suizo**: empareja dentro de cada grupo de puntaje (mitad superior contra
  mitad inferior) y evita revanchas salvo que sean inevitables (backtracking
  acotado). Un bye por entrant como máximo; el bye cuenta como victoria sin
  partidas. Quien llega a `winsToAdvance` o `lossesToEliminate` deja de jugar.

**Agregar un formato** (Open/Closed): implementar `PhaseFormatStrategy`,
registrarlo con `registry.register(strategy)` y, para tiparlo, extender
`PhaseFormatConfigs` por declaration merging. Los formatos existentes no se
tocan.

## Fearless Draft

```ts
import { computeFearlessLocks, validateDraft } from '@league/core';

const locks = computeFearlessLocks({ entrants: ['aurora', 'basalto'], games }, { mode: 'per_team' });
validateDraft(locks, proposedPicks, ['aurora', 'basalto']);
// → { valid: false, violations: [{ reason: 'champion_locked', entrantId, championId, lockedByGame }] }
```

- `per_team` (estándar de la escena): un equipo no repite sus campeones.
- `global`: nadie repite ninguno de los ya jugados.
- Los remakes no bloquean. `FearlessLock` refleja la tabla `fearless_locks`.

## Elegibilidad

```ts
import { evaluateEligibility } from '@league/core';

evaluateEligibility(
  { entrantId: null, teamId: 'team-aurora', players },
  [{ type: 'riot_account_verified' }, { type: 'rank_max', params: { rank: { tier: 'gold', division: 1 } } }],
  { now: '2026-10-24T12:00:00Z', tournament: { id, tier: 3, seasonId, circuitId } },
);
// → { eligible, passed: [{ position, rule }], failed: [{ position, rule, userId, reason, details }] }
```

- Reglas: `riot_account_verified`, `region`, `country`, `rank_min`, `rank_max`,
  `peak_rank_max` (`windowDays`), `account_level_min`, `account_age_min`,
  `ranked_games_min`, `age_min`, `gender` (`allowed`, `declaredBefore`),
  `institution` (`institutionId` o `emailDomains`), `max_tier_roster`,
  `exclusivity` (`scope`: `none`, `tournament`, `circuit` o `season`;
  `cooldownDays`), `not_sanctioned` y `legal_name_required`.
- `appliesTo: 'team_average'` (solo reglas de rango) compara el promedio del
  roster.
- Cada regla es una `Specification` (`and` con cortocircuito, `or`, `not`). Para
  agregar una: una entrada en `ELIGIBILITY_RULES`, o un mapa propio como cuarto
  argumento de `evaluateEligibility`.
- **Exclusividad**: falla si el jugador tiene un roster activo de otro equipo
  (o de otro entrant ad-hoc) dentro del ámbito, o si salió de uno hace menos de
  `cooldownDays`. Jugar con el mismo equipo en otro torneo del ámbito está
  permitido.
- Los `reason` tienen mensaje en `packages/i18n` (`eligibility.reasons.*`): el
  portal muestra "no eres elegible por…".
- `assertEligible` lanza `IneligibleEntrantError` con las fallas.

## Ciclos de vida

```ts
import { matchLifecycle } from '@league/core';

matchLifecycle.transition('ready', { type: 'go_live' }, context); // → 'live' o error tipado
matchLifecycle.can(status, event, context);
matchLifecycle.availableEvents(status);
```

| Máquina | Transiciones (guard) |
|---------|----------------------|
| `tournamentLifecycle` | draft →publish (≥ 1 fase)→ published →open_registration→ registration_open ⇄ registration_closed →start_seeding (≥ mínimo de inscritos)→ seeding →start→ in_progress →complete (fases terminadas)→ completed →archive→ archived. `cancel` desde cualquier estado antes de completed. |
| `matchLifecycle` | pending →schedule (entrants definidos)→ scheduled →open_checkin→ checkin →checkin_complete (ambos check-in)→ ready →go_live (ambos check-in)→ live →finish_games→ awaiting_result →confirm_result (ganador del match)→ completed. `dispute` desde awaiting_result o desde completed dentro de la ventana; `forfeit` antes del resultado final; `cancel` antes de completed/forfeit; reprogramar = `schedule` desde scheduled o checkin. |
| `gameLifecycle` | pending →open_lobby→ lobby →start→ live →complete (ganador)→ completed; `remake` desde lobby o live; `forfeit` (ganador) antes de terminar. |

Transición no permitida → `InvalidTransitionError`; guard rechazado →
`TransitionGuardError` con `details.reason` (`checkin_missing`,
`winner_missing`, `dispute_window_closed`…). Con `createStateMachine` se define
una máquina nueva.

## Fuera de alcance

Persistencia, Riot, Discord, correo, generación de códigos de torneo y UI (los
usa la API a través de `core`).
