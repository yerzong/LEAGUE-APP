# Módulo 09 — Estadísticas y perfiles pro (efecto LCK)

> Spec para Claude Code. Lo que engancha y retiene al jugador: perfiles con
> pro-stats, radares, campeones, MVP, logros. Deriva de los datos de partida
> (`games.raw_match_payload` del m05/m08). Referencias:
> `docs/03-modelo-datos.md §8`, `docs/08-design-system.md §5`,
> `docs/14-modulos-funcionales.md §5`. Estándares: `docs/17-estandares-ingenieria.md`.

---

## Alcance

### 1. Base de datos (`docs/03 §8`)
- `player_game_stats`, `team_game_stats`, `game_timeline_events` (selección de
  eventos notables), `player_aggregate_stats` (por ámbito: torneo/circuito/
  temporada/all-time, con el radar), `player_champion_stats`,
  `team_aggregate_stats`, `champion_meta_stats`, `achievements`,
  `user_achievements`, `mvp_awards`, `follows`. RLS y Realtime donde aplique.

### 2. Derivación de stats (core + worker)
- Al completar un game con `raw_match_payload` (venga de Riot o manual), derivar
  `player_game_stats` y `team_game_stats`: KDA, CS/min, oro/min, daño, participación
  de kills, visión, objetivos, items, runas.
- Cálculo **puro en `packages/core`** (TDD): dado el payload normalizado, producir
  las stats; dado un conjunto de games, producir los agregados y el **radar**
  (agresividad, visión, farm, teamfight, supervivencia — 0-100, normalizado).
- Recalcular agregados por job al cerrar cada partida (idempotente).
- Si no hay `raw_match_payload` (resultado solo manual sin datos), degradar con
  elegancia: mostrar W/L y marcador, sin stats detalladas.

### 3. Logros y MVP
- Motor de logros: reglas configurables (`achievements.criteria`) evaluadas al
  derivar stats (ej. primer pentakill, racha de X victorias, MVP de jornada).
- MVP por game/match/jornada/torneo (`mvp_awards`), con posibilidad de patrocinio
  (`sponsor_placement_id`, se llena en el módulo de monetización).

### 4. Web — perfiles y páginas
- **Jugador** (`/jugadores/[username]`): completar con pro-stats — radar,
  campeones más jugados con winrate, evolución, logros, historial. Head-to-head
  contra otro jugador.
- **Equipo** (`/equipos/[slug]`): stats de equipo, forma reciente, roster con
  mini-stats.
- **Torneo** (`/torneos/[slug]`): líderes por stat (top KDA, más daño…),
  campeones más pickeados/baneados (`champion_meta_stats`), MVP de la jornada.
- Gráficos (radar, barras) con componentes en `packages/ui`, consistentes con el
  design system; usar los datos de Data Dragon de Riot para nombres/íconos de
  campeones (estáticos, permitidos).

### 5. Seguir (follows)
- Seguir jugadores/equipos/torneos; base para notificaciones de "tu equipo juega"
  (se engancha al m06) y para la app móvil futura.

---

## Lo que NO va
- Overlays de transmisión (módulo de broadcast).
- Narrativa IA / crónicas (módulo de contenido IA).
- Generación de gráficos para redes (módulo de media).

## Criterios de aceptación
- [ ] Con el seed demo (liga con jornadas jugadas), los perfiles muestran radar y
      campeones; la página del torneo muestra líderes y meta de campeones.
- [ ] El cálculo del radar es puro y testeado (mismos datos → mismo radar).
- [ ] Recalcular stats es idempotente; completar una partida nueva actualiza los
      agregados en vivo.
- [ ] Partidas sin `raw_match_payload` degradan a W/L sin romper la UI.
- [ ] Seguir/dejar de seguir funciona y respeta privacidad.
- [ ] `pnpm lint typecheck test build` pasa; UI con `packages/ui` e i18n; sin hex.

## Notas
- El seed demo ya da datos de liga jugada: ideal para ver perfiles poblados sin
  depender de Riot. Con datos manuales las stats detalladas serán limitadas hasta
  que entre el m08 (Match-V5), que trae el payload completo.
- Data Dragon: usar los assets estáticos de campeones/íconos (permitido por Riot),
  cacheados; no confundir con la API de datos en vivo.
