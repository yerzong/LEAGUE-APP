# Módulo 01 — Motor de torneos (`packages/core`)

> Spec para Claude Code. El corazón del producto: la lógica PURA de competencia.
> Sin frameworks, sin base de datos, sin red, sin React. Recibe datos, devuelve
> decisiones. Es lo que hace único a PENTA League y lo que se empaqueta como SaaS.
> Reglas de negocio: `docs/02-formatos-competencia.md` y `docs/13-reglas-integridad.md`.
> Estándares: `docs/17-estandares-ingenieria.md` (TDD obligatorio aquí).

---

## Principio rector

`packages/core` **no importa** Prisma, NestJS, Supabase, Zod-de-API ni nada de
I/O. Funciones y clases puras: entra un estado, sale un resultado. Todo
determinista (mismos datos → mismo resultado), por eso se prueba al 100%.

- **TDD estricto:** por cada regla, primero el test (RED), luego el código
  (GREEN), luego limpieza (REFACTOR).
- Tipos propios del dominio (no los de la base de datos). Si se necesitan tipos
  compartidos con la API, van en `packages/contracts`, no aquí.
- Errores de dominio tipados (ej. `IneligibleEntrantError`), nunca `throw` de
  strings.

---

## Alcance (se puede dividir en ramas encadenadas por área)

### 1. Tipos del dominio
Modelar como tipos puros: `Entrant`, `Phase`, `Group`, `Match`, `Game`,
`Standing`, `PointsRule`, `TiebreakRule`, `ChampionId`, `Side`, enums de formato
y de serie. Alineados conceptualmente con `03-modelo-datos.md` pero sin depender
de él.

### 2. Formatos de fase (Strategy pattern)
Interfaz `PhaseFormatStrategy` con, al menos:
- `generateMatches(entrants, config)` → lista de `Match` (bracket o calendario).
- `computeStandings(matches, pointsRule, tiebreakRule)` → `Standing[]` ordenado.
- `resolveAdvancement(standings, advancement)` → quién clasifica.
- `onMatchCompleted(bracket, match)` → avanza ganador/perdedor (para brackets).

Estrategias a implementar:
- **Round Robin** (una y dos vueltas).
- **Grupos** (varios round robin en paralelo).
- **Eliminación simple** (single elim, con bye si el número no es potencia de 2).
- **Eliminación doble** (upper/lower bracket, gran final).
- **Suizo** (emparejamiento por puntos, evitar repetir rival, manejar byes).
Un **registro de estrategias** para resolver por el enum de formato (Open/Closed:
agregar un formato nuevo no modifica los existentes).

### 3. Sistema de puntos y desempates
- `PointsRule` configurable (puntos por victoria/derrota/empate, bonus).
- `TiebreakRule` como **Chain of Responsibility**: lista ordenada de criterios
  (`head_to_head`, `game_diff`, `wins`, `points`, …). Cada criterio desempata o
  cede al siguiente. Debe reportar POR QUÉ quedó un orden (para mostrarlo en la
  web).
- Casos borde: empate total irresoluble (devolver "requiere tiebreaker manual").

### 4. Series y partidas
- Resolver resultado de una serie Bo1/Bo3/Bo5 a partir de sus `Game`.
- Determinar si la serie terminó y quién ganó.
- Validar coherencia (no más games de los que permite el formato, ganador es
  participante, etc.).

### 5. Fearless Draft
- Dado el historial de picks de una serie, calcular los **campeones bloqueados**
  por equipo para el siguiente game.
- Validar un draft propuesto contra esas restricciones.
- Configurable: Fearless por equipo (no repite los suyos) — el modo estándar de
  la escena. Dejar la puerta para variantes (global) sin romper la API.

### 6. Motor de elegibilidad (Specification pattern)
- Cada regla de `13-reglas-integridad.md` como una **Specification** componible:
  `rank_max`, `peak_rank_max`, `account_level_min`, `age_min`, `region`,
  `institution`, `gender` (+ `declared_before`), `max_tier_roster`,
  `exclusivity`, `not_sanctioned`, etc.
- `evaluate(entrant, rules, context)` → resultado con la lista de reglas que
  pasan y las que fallan, cada falla con un mensaje legible (para mostrar en el
  portal "no eres elegible por X").
- La **exclusividad** (anti-chapulineo) se modela aquí como regla pura: dado el
  ámbito y los rosters activos, decir si un jugador puede entrar.

### 7. Máquinas de estado
- Transiciones válidas de `Tournament`, `Match` y `Game` (y sus guards): p. ej.
  un match no pasa a `live` sin check-in, no se completa sin ganador. Pura:
  recibe estado + evento → nuevo estado o error.

---

## Lo que NO va aquí
- Persistencia (eso lo hará el módulo que use `core` desde la API).
- Llamadas a Riot, Discord, correo.
- Generación de códigos de torneo (eso es integración, no dominio).
- UI.

## Criterios de aceptación
- [ ] `pnpm --filter @league/core test` con **cobertura alta** (objetivo ≥ 90%
      en statements/branches del dominio).
- [ ] Cada formato tiene tests con casos reales: 4, 6, 8 y un número impar de
      entrants; byes; dobles empates; series Bo1/Bo3/Bo5.
- [ ] Tests de desempate que verifican el ORDEN y la RAZÓN.
- [ ] Tests de Fearless: campeones bloqueados correctos a lo largo de un Bo5.
- [ ] Tests de elegibilidad por cada tipo de regla y de exclusividad.
- [ ] Tests de transiciones de estado inválidas (deben fallar con error tipado).
- [ ] `pnpm lint typecheck build` pasa; `core` sigue sin dependencias de
      framework/IO (revisable en su `package.json`).
- [ ] API pública de `core` documentada en su `README.md` con ejemplos.

## Notas
- Priorizar Round Robin, single elim y el sistema de puntos/desempates primero
  (es lo que usa el piloto). Doble elim y suizo pueden ir en una segunda rama.
- Todo configurable por datos, no por código: los formatos leen `config`, no
  constantes hardcodeadas.
