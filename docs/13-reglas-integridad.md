# Reglas de Elegibilidad, Restricciones e Integridad Competitiva

> Documento vivo. Responde: quién puede competir dónde, cómo se evita el
> "chapulineo" entre equipos, cómo funcionan los formatos 1v1/2v2, cómo se
> evitan trampas y quién valida los resultados. Todas las reglas son
> **configurables por torneo**, con defaults sensatos por tipo de evento.

---

## 1. Conceptos base (vocabulario del dominio)

| Concepto | Qué es |
|----------|--------|
| **Equipo permanente** | Identidad persistente (nombre, tag, logo, historial). Compite en ligas y circuitos. |
| **Equipo ad-hoc** | Equipo creado para UN evento (ej. dúo para un relámpago 2v2). No afecta rosters permanentes. |
| **Entrant (participante)** | La entidad que compite en un torneo: una inscripción con su roster congelado. Puede ser de 1 jugador (1v1) o de N. **Los matches son entre entrants, no entre equipos.** |
| **Roster de inscripción** | Snapshot de los jugadores registrados para ese torneo (titulares + suplentes + coach). |
| **Tier (categoría)** | Nivel competitivo del torneo: Tier 1 (Liga Principal), Tier 2 (Ascenso), Tier 3 (Abiertos/Relámpagos). |
| **Ámbito de exclusividad** | Dónde un jugador solo puede estar en UN roster a la vez: torneo, circuito, temporada o ninguno. |

> Diseñar sobre **Entrant** (y no sobre Team) es lo que permite que el mismo
> motor soporte 1v1, 2v2 y 5v5 sin código especial.

---

## 2. Modos de juego soportados

Riot Tournament-V5 permite configurar por código de torneo: tamaño de equipo
(1 a 5), mapa (Grieta del Invocador o Abismo de los Lamentos), tipo de selección
(Tournament Draft, Blind Pick, Draft Mode, All Random) y espectadores.

| Modo | team_size | Mapa | Uso típico |
|------|-----------|------|-----------|
| 5v5 Grieta | 5 | Summoner's Rift | Ligas, circuitos |
| 5v5 ARAM | 5 | Howling Abyss | Relámpagos casuales |
| 2v2 | 2 | Rift / Abyss | Relámpagos de dúos |
| 1v1 | 1 | Rift / Abyss (mid) | Relámpagos de duelo |

Reglas específicas por modo (configurables):
- **1v1:** condiciones de victoria (primera sangre, 100 CS, primera torre). El
  sistema no las puede leer del callback de Riot (este solo da ganador), así que
  el ganador del lobby es el resultado oficial y la regla se comunica en el
  reglamento. Validar en prototipo cómo terminar la partida al cumplir la
  condición (rendición).
- **2v2 / 1v1:** se recomiendan entrants **ad-hoc**. No cuentan para el roster ni
  la exclusividad de la liga salvo que el torneo lo configure.

---

## 3. Exclusividad de jugadores (anti-chapulineo)

### Regla principal
Un jugador **solo puede pertenecer a UN roster activo dentro del ámbito de
exclusividad** del torneo.

| Tipo de torneo | Ámbito por defecto | Efecto |
|----------------|--------------------|--------|
| Liga Principal / Ascenso | **Temporada** | Si juegas para el Equipo A en la temporada, no puedes jugar para B en ninguna liga de esa temporada |
| Circuito (femenil, universitario) | **Circuito** | Exclusivo dentro del circuito; puedes jugar liga principal con otro equipo si el circuito lo permite |
| Relámpago | **Torneo** | Solo un entrant por relámpago; libre de jugar con otros en otro relámpago |
| Casual / exhibición | **Ninguno** | Sin restricción |

### Controles complementarios
- **Ventanas de transferencia:** en ligas, altas/bajas solo dentro de ventanas
  definidas. Fuera de ventana: solicitud de cambio con aprobación de admin.
- **Límite de cambios de roster** por split (ej. máximo 2 altas).
- **Cooldown de salida:** al salir de un equipo, el jugador no puede unirse a
  otro roster del mismo ámbito durante X días (ej. 14).
- **Roster lock:** al iniciar la fase de playoffs el roster se congela.
- **Mínimo de partidas jugadas** para ser elegible a playoffs (evita "fichajes
  de último momento").
- **Historial público** de membresías (quién jugó dónde y cuándo).

---

## 4. Restricción por categoría (tiers)

Objetivo: evitar que un equipo de Liga Principal entre a un torneo de menor nivel
a "farmear" premios contra novatos.

Reglas configurables por torneo:
- `max_tier_allowed`: equipos/jugadores que estén en un roster de tier superior
  **no pueden inscribirse**. Ej.: un relámpago Tier 3 puede bloquear a jugadores
  con roster activo en Tier 1.
- **Límite de elo** por jugador (rango máximo) y/o promedio del equipo.
- **Peak rank de temporada** en lugar del rango actual (evita bajar de elo a
  propósito para entrar). Requiere guardar snapshots periódicos de rango, porque
  la API de Riot solo da el rango actual.
- **Excepción manual** de admin con motivo registrado en auditoría.

> Respuesta a tu duda: sí, una liga puede bloquear que sus equipos entren a
> torneos de menor categoría, pero se decide **por torneo** (el relámpago define
> si los acepta o no). Hay relámpagos abiertos donde todos son bienvenidos.

---

## 5. Elegibilidad general (motor de reglas)

La elegibilidad se modela como **lista de reglas evaluables** (no código fijo).
Cada regla tiene tipo, parámetros y mensaje de error. Se evalúan al inscribirse y
al modificar roster.

| Regla | Parámetros | Ejemplo |
|-------|-----------|---------|
| `riot_account_verified` | — | Todos deben tener cuenta Riot verificada |
| `region` | lista | Solo LAN |
| `rank_min` / `rank_max` | tier/división | Oro IV – Diamante I |
| `peak_rank_max` | tier, ventana | Peak ≤ Diamante en los últimos 90 días |
| `account_level_min` | nivel | ≥ 50 |
| `account_age_min` | días | Cuenta con ≥ 60 días |
| `ranked_games_min` | número | ≥ 50 ranked en la temporada |
| `age_min` | años | ≥ 16 (premios en efectivo) |
| `gender` | valores, `declared_before` (fecha, opcional) | Evento femenil: solo cuentas que declararon "mujer" antes del anuncio del evento |
| `voice_comms_required` | — | Voz en Discord obligatoria durante las partidas; referee puede entrar sin aviso |
| `camera_required` | fases | Cámara obligatoria en finales o con premio en efectivo |
| `institution` | institución, dominio | Correo institucional verificado |
| `country` | lista | México |
| `max_tier_roster` | tier | Sin roster activo en Tier 1 |
| `exclusivity` | ámbito | Temporada |
| `not_sanctioned` | — | Sin sanción vigente |
| `legal_name_required` | — | Nombre legal capturado (premios) |

> Esto es lo que hace el formulario de crear torneo "totalmente configurable":
> el admin arma la lista de reglas con checkboxes y valores.

---

## 6. Límites operativos

| Límite | Nivel | Default sugerido |
|--------|-------|------------------|
| Equipos permanentes que un usuario puede **crear** | Organización | 2 |
| Equipos permanentes donde puede ser **capitán** a la vez | Organización | 1 |
| Rosters activos por jugador por ámbito | Torneo | 1 |
| Capacidad del torneo (entrants) | Torneo | 16 / 32 / 64 |
| Lista de espera | Torneo | Sí, con orden de llegada |
| Tamaño de roster (titulares/suplentes/coach) | Torneo | 5 / 2 / 1 |
| Inscripciones simultáneas por equipo | Organización | Sin límite (respetando exclusividad) |

Los límites viven en la configuración de la organización y se pueden sobreescribir
por torneo.

---

## 7. Anti-trampas (capas de defensa)

### Capa 1 — Identidad
- Cuenta Riot vinculada y **verificada** (ver `12-auth-roles-perfiles.md`).
- **Una cuenta Riot = un usuario de la plataforma** (PUUID único). No se puede
  vincular la misma cuenta a dos usuarios.
- Cuentas secundarias declaradas (opcional) para detectar smurfs.

### Capa 2 — Lobby cerrado
- Los códigos de torneo se generan con la **lista de cuentas permitidas** (PUUIDs
  del roster congelado). Solo los jugadores inscritos pueden entrar al lobby.
  Esto elimina el "ringer" (que juegue alguien que no está inscrito).
- Un código por partida, de un solo uso.

### Capa 3 — Verificación post-partida
- Al recibir el resultado, el sistema compara los participantes reales de la
  partida (Match-V5) contra el roster. Cualquier discrepancia genera una
  **alerta de integridad** automática.
- Se verifica que ambos lados correspondan a los entrants correctos.

### Capa 4 — Smurfs, derank y boosting
- Seguimiento del **peak rank** con snapshots periódicos.
- Señales: cuenta reciente, nivel bajo con rendimiento alto, winrate anómalo,
  saltos bruscos de rango, cambios de Riot ID frecuentes.
- La IA **marca** casos con puntuación de riesgo; **un humano decide**. Nunca
  sanción automática por IA.

### Capa 5 — Conducta y sanciones
- Reglamento y código de conducta aceptados al inscribirse (con versión).
- Registro de sanciones con alcance y duración: advertencia, pérdida de partida,
  descalificación, veto temporal o permanente.
- Lista de vetados que el motor de elegibilidad consulta (`not_sanctioned`).
- Todo queda en **auditoría** inmutable.

> Lo que NO podemos controlar: trampas dentro del cliente (scripts). Eso lo cubre
> el anti-cheat Vanguard de Riot.

---

## 8. ¿Quién valida los resultados? (no siempre hace falta alguien viendo)

No es necesario que una persona vea **todas** las partidas. Se definen **niveles
de supervisión** por torneo/fase:

| Nivel | Cómo se obtiene el resultado | Cuándo usarlo |
|-------|------------------------------|---------------|
| **Automático** | Callback de Riot (Tournament API). El resultado es oficial al llegar. | Default con Production Key |
| **Doble reporte** | Ambos capitanes reportan + captura. Si coinciden, se confirma solo. Si no, pasa a disputa. | Sin Riot API o como respaldo |
| **Árbitro asignado** | Un referee asignado confirma/valida (puede estar como espectador en el lobby). | Playoffs, finales, Tier 1 |
| **Transmitido** | Hay observador de producción en el lobby (obligatorio para overlays en vivo). | Partidas con stream |

Reglas complementarias:
- **Ventana de disputa** (ej. 24 h después de la partida) para reclamar.
- Correcciones de resultado solo por staff con motivo, registradas en auditoría,
  y el sistema recalcula standings solo.
- El referee puede ver en su panel: lobby, participantes esperados vs. reales,
  estado de check-in y alertas.

---

## 9. Reprogramaciones, no-shows y pausas

- **Solicitud de reprogramación** entre capitanes: uno propone, el otro acepta,
  el admin aprueba (si la fase lo exige). Con fecha límite.
- **Check-in** obligatorio con ventana configurable (ej. abre T-30, cierra T-10).
- **Forfeit automático** si no hay check-in; tolerancia configurable.
- **Pausas y remakes:** límites por partida definidos en reglamento; el referee
  los registra.

---

## 10. Versionado del reglamento

- Al publicar un torneo, sus reglas se **congelan como versión**. Si el admin
  edita reglas después, se crea una nueva versión con registro de cambios y aviso
  a los equipos inscritos.
- Cada inscripción guarda qué versión del reglamento aceptó.
