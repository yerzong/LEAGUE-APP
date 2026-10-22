# Modelo de Datos — League App

> Documento vivo. Define las entidades, relaciones y reglas de integridad del
> sistema. Diseñado **multi-torneo desde el día 1** y con el **motor de torneos
> aislado** para habilitar el SaaS futuro. Todos los parámetros de competencia
> son configurables por evento (contrato de `02-formatos-competencia.md`).

---

## 1. Principios del modelo

1. **Multi-tenant desde el diseño.** La raíz es la **Organización**, no la liga.
   Una organización contiene N torneos de N tipos. Esto habilita el SaaS sin
   reescritura (cada cliente SaaS = una organización).
2. **Nada hardcodeado.** Formato, series, draft, puntos y desempates son datos
   configurables, no código.
3. **El core de torneos es un dominio aislado.** Entidades de competencia
   (Tournament, Phase, Match, Game, Standing) no dependen de entidades de marca,
   pagos ni Discord. Viven en `packages/core` (ver `04-arquitectura.md`).
4. **Trazabilidad.** Todo registro relevante tiene `created_at`, `updated_at`, y
   borrado lógico (`deleted_at`) donde aplique.
5. **IDs opacos.** UUID/ULID como claves primarias (no enteros autoincrementales
   expuestos), por seguridad y para merges futuros.

---

## 2. Mapa de dominios

```
┌─ IDENTIDAD Y ACCESO ─────────┐   ┌─ MARCA / ORGANIZACIÓN ───────┐
│ User, Account, Role,         │   │ Organization, Brand,         │
│ RiotAccountLink              │   │ Membership, Sponsor          │
└──────────────────────────────┘   └──────────────────────────────┘

┌─ CORE DE TORNEOS (aislado) ──────────────────────────────────────┐
│ Tournament, Circuit, Phase, Group, Match, Game,                  │
│ Team, Player, TournamentRegistration, Roster, Standing,          │
│ DraftRecord, PointsRule, TiebreakRule                            │
└───────────────────────────────────────────────────────────────────┘

┌─ ESTADÍSTICAS ───────────────┐   ┌─ OPERACIÓN / AUTOMATIZACIÓN ─┐
│ PlayerMatchStats,            │   │ Notification, DiscordLink,   │
│ PlayerAggregateStats,        │   │ AutomationJob, AuditLog,     │
│ TeamAggregateStats           │   │ MediaAsset                   │
└──────────────────────────────┘   └──────────────────────────────┘

┌─ CONTENIDO / IA ─────────────┐   ┌─ PAGOS ──────────────────────┐
│ MatchNarrative, PressNote,   │   │ Payment, Invoice,            │
│ GraphicRender                │   │ Subscription, Payout         │
└──────────────────────────────┘   └──────────────────────────────┘
```

---

## 3. Identidad y acceso

### User
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| email | string | único |
| display_name | string | |
| password_hash | string | null si solo usa OAuth/RSO |
| locale | string | es-MX por defecto |
| created_at / updated_at | datetime | |

### Account (cuenta de juego / identidad externa)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| user_id | FK User | |
| provider | enum | `riot`, `discord` |
| external_id | string | PUUID (Riot) o Discord ID |
| data | json | metadata del proveedor |

### RiotAccountLink
Vínculo verificado a una cuenta de Riot (para stats y anti-smurf).
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| user_id | FK User | |
| puuid | string | identificador estable de Riot |
| summoner_name | string | cacheado |
| region | enum | LAN, LAS, NA, etc. |
| current_rank | json | tier/division/LP cacheado |
| verified_at | datetime | null hasta verificar |

### Role / Membership (acceso por organización — multi-tenant)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| user_id | FK User | |
| organization_id | FK Organization | |
| role | enum | `owner`, `admin`, `operator`, `caster`, `player`, `viewer` |

> Los permisos se evalúan **por organización**: un usuario puede ser admin en una
> y jugador en otra. Base del modelo SaaS.

---

## 4. Marca / Organización (raíz multi-tenant)

### Organization
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| name | string | |
| slug | string | único, para URLs |
| plan | enum | `self` (tu liga), `saas_basic`, `saas_pro` (futuro) |
| settings | json | configuración global de la org |
| created_at / updated_at | datetime | |

### Brand
Identidad visual de la organización (colores, logos, tipografías) — alimenta el
design system y la generación de gráficos.
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| organization_id | FK | |
| logo_url | string | |
| theme | json | tokens: colores, tipografías |

### Sponsor
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| organization_id | FK | |
| name | string | |
| logo_url | string | |
| tier | enum | `title`, `gold`, `section` |
| category | string | para validar contra prohibidos (apuestas/cripto) |
| active_from / active_to | date | |

---

## 5. Core de torneos (dominio aislado)

### Circuit
Agrupa varios torneos en un ranking de temporada (circuito de puntos).
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| organization_id | FK | |
| name | string | |
| season | string | ej. "2026 Split 1" |
| points_aggregation | json | cómo suma puntos de sus torneos |

### Tournament
El evento. **Aquí viven los parámetros configurables.**
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| organization_id | FK | |
| circuit_id | FK Circuit | nullable (puede no pertenecer a circuito) |
| name | string | |
| type | enum | `league`, `flash`, `womens`, `university`, `ranked_tier` |
| status | enum | `draft`, `registration`, `seeding`, `live`, `completed`, `archived` |
| eligibility | json | reglas: región, elo min/max, institución, género, etc. |
| roster_rules | json | tamaño min/max, suplentes, ventana de cambios |
| registration_window | json | fechas de apertura/cierre, cupo, fee |
| default_series_format | enum | `bo1`, `bo3`, `bo5` (por defecto; cada fase puede sobreescribir) |
| default_draft_mode | enum | `standard`, `fearless` |
| points_rule_id | FK PointsRule | |
| tiebreak_rule_id | FK TiebreakRule | |
| settings | json | extras |

### Phase
Una etapa (Temporada Regular, Playoffs...). Varias por torneo, ordenadas.
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| tournament_id | FK | |
| name | string | |
| order | int | secuencia |
| format | enum | `round_robin`, `groups`, `single_elim`, `double_elim`, `swiss` |
| series_format | enum | `bo1`, `bo3`, `bo5` (sobreescribe el default del torneo) |
| draft_mode | enum | `standard`, `fearless` (sobreescribe el default) |
| advancement | json | cuántos y cómo clasifican a la siguiente fase |

### Group
Para fases con grupos.
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| phase_id | FK | |
| name | string | ej. "Grupo A" |

### PointsRule / TiebreakRule
Reglas configurables reutilizables.
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| organization_id | FK | |
| name | string | |
| config | json | `win_points`, `draw_points`, `loss_points`, bonus... |

TiebreakRule.config: lista ordenada de criterios (`head_to_head`, `game_diff`,
`tiebreaker_match`...).

### Team
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| organization_id | FK | |
| name | string | |
| tag | string | abreviatura, ej. "T1" |
| logo_url | string | |
| captain_user_id | FK User | |

### Player
Un jugador dentro de un equipo (perfil competitivo).
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| user_id | FK User | |
| riot_account_link_id | FK | |
| main_role | enum | `top`, `jungle`, `mid`, `adc`, `support` |

### TournamentRegistration
Inscripción de un equipo a un torneo (estado, elegibilidad, pago).
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| tournament_id | FK | |
| team_id | FK | |
| status | enum | `pending`, `approved`, `rejected`, `withdrawn` |
| seed | int | nullable |
| payment_id | FK Payment | nullable |

### Roster
Alineación registrada de un equipo para un torneo (titulares + suplentes).
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| registration_id | FK | |
| player_id | FK Player | |
| is_substitute | bool | |

### Match (serie)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| phase_id | FK | |
| group_id | FK | nullable |
| team_a_id / team_b_id | FK Team | |
| series_format | enum | heredado de la fase |
| draft_mode | enum | heredado de la fase |
| scheduled_at | datetime | |
| status | enum | `scheduled`, `checkin`, `live`, `completed`, `forfeit`, `canceled` |
| winner_team_id | FK Team | nullable |
| score | json | ej. `{"a":2,"b":1}` |

### Game (partida individual dentro de la serie)
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| match_id | FK | |
| game_number | int | 1..N |
| riot_tournament_code | string | código generado (Fase 2, nullable) |
| riot_match_id | string | id de la partida en Riot (nullable) |
| winner_team_id | FK Team | |
| duration_seconds | int | |
| raw_payload | json | JSON crudo de Match-V5 (fuente de verdad para stats) |

### DraftRecord (soporte Fearless)
Registro de campeones usados por equipo en una serie, para impedir repetición.
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| match_id | FK | |
| game_id | FK | |
| team_id | FK | |
| champion_id | int | campeón pickeado |
| action | enum | `pick`, `ban` |

### Standing
Posición calculada de un equipo en una fase/grupo.
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| phase_id | FK | |
| group_id | FK | nullable |
| team_id | FK | |
| points | int | |
| wins / losses | int | |
| game_diff | int | |
| rank | int | posición calculada |

---

## 6. Estadísticas

### PlayerMatchStats
Stats de un jugador en una partida (derivadas de `Game.raw_payload`).
| Campo | Tipo | Notas |
|-------|------|-------|
| id | ULID | PK |
| game_id | FK | |
| player_id | FK | |
| champion_id | int | |
| kills / deaths / assists | int | |
| gold / cs / damage / vision_score | int | |
| kda | float | calculado |
| gpm | float | oro por minuto |

### PlayerAggregateStats / TeamAggregateStats
Agregados por torneo/circuito para los perfiles con radar (agresividad, visión,
farm, KP) y comparativas head-to-head. Recalculados por job tras cada partida.

---

## 7. Operación / automatización

### DiscordLink
Vincula equipos/torneos con servidores y canales de Discord (bot).
### Notification
Avisos salientes (Discord, email) con estado de entrega.
### AutomationJob
Trabajos programados o por evento (generar código, check-in, recalcular stats,
renderizar gráfico). Estado, reintentos, payload.
### AuditLog
Registro inmutable de acciones sensibles (quién cambió qué, para disputas).
### MediaAsset
Imágenes/clips generados (resultado, MVP, standings) con su URL y metadata.

---

## 8. Contenido / IA

### MatchNarrative / PressNote
Texto generado por IA desde la línea de tiempo de la partida (resumen, nota de
prensa, guion de caster). Vinculado a Match/Game. Estado: `draft`, `published`.
### GraphicRender
Render de una plantilla parametrizada (datos + template → imagen). Vinculado al
evento que lo disparó.

---

## 9. Pagos

### Payment / Invoice / Subscription / Payout
Detrás de una abstracción (ver `09-monetizacion.md`). `provider` guarda el
procesador (`stripe`) y `provider_ref` el id externo. Nunca se guardan datos
sensibles de tarjeta (los maneja el procesador).

---

## 10. Reglas de integridad clave

- Un `Match` referencia dos equipos **inscritos y aprobados** en el torneo de su
  fase.
- `Game.game_number` es único por `Match`.
- En `draft_mode = fearless`, al generar el draft de un `Game` se valida contra
  `DraftRecord` de los `Game` previos de ese `Match`.
- `Standing` se recalcula por job tras cerrar cada `Match`; nunca se edita a mano
  salvo override auditado.
- `winner_team_id` de un `Match` debe ser `team_a_id` o `team_b_id`.
- Borrado lógico en entidades con historial (Team, Player, Tournament); los
  registros de competencia (Match, Game, Stats) no se borran, se archivan.

---

## 11. Cómo esto habilita el SaaS

- La **Organization** como raíz = cada cliente SaaS es una organización aislada.
- El **core de torneos** no conoce marca, pagos ni Discord: se puede empaquetar.
- **PointsRule/TiebreakRule/Phase.format** configurables = cualquier organizador
  arma su formato sin tocar código.
- Permisos **por organización** = multi-tenant real desde el día 1.
