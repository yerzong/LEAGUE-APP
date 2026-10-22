# Formatos de Competencia y Reglas — League App

> Documento vivo. El corazón del producto. No requiere código: define QUÉ se
> compite y CÓMO se gana. El modelo de datos (`03-modelo-datos.md`) se diseña
> para soportar todo lo de aquí.

---

## 1. Principio: una organización, muchos torneos

La marca opera **N torneos de N tipos** en paralelo. Cada torneo es una instancia
independiente con su propio formato, calendario y reglas, pero comparten equipos,
jugadores y la identidad de marca.

Tipos de torneo soportados desde el diseño:

| Tipo | Rol en el ecosistema | Duración típica |
|------|----------------------|-----------------|
| **Liga Principal** | El torneo insignia, formato tipo LCK | Varias semanas |
| **Relámpago** | Embudo de captación, prueba de sistema | 1 día / fin de semana |
| **Circuito Femenil** | Comunidad dedicada, atractivo para patrocinio | Varias semanas |
| **Circuito Universitario** | Representación por escuela | Varias semanas |
| **Por Rangos / Niveles** | Segmentación por elo para equilibrio | Variable |

Todos usan los mismos bloques de construcción (fases, series, partidas, puntos).
Cambian los parámetros, no la maquinaria.

---

## 2. Bloques de construcción comunes

Cualquier torneo se arma combinando estos bloques:

- **Fase** — una etapa del torneo (ej. Temporada Regular, Playoffs).
- **Formato de fase** — cómo se organiza: Round Robin, Grupos, Eliminación
  simple, Eliminación doble, Suizo.
- **Serie (Match)** — enfrentamiento entre dos equipos: Bo1, Bo3, Bo5.
- **Partida (Game)** — un juego individual dentro de una serie.
- **Sistema de puntos** — cómo se ordena la tabla.
- **Reglas de clasificación / desempate** — quién avanza y cómo se rompen empates.

---

## 3. Modo de Draft (regla transversal)

- **Draft estándar** (Tournament Draft / Picks & Bans normal) — para relámpagos
  y fases de grupos.
- **Fearless Draft** — a lo largo de una serie, **no se pueden repetir los
  campeones ya jugados** por un equipo en partidas anteriores de esa misma serie.
  Formato oficial actual muy popular. Reservado para Playoffs de Liga Principal y
  series de alto nivel. Requiere llevar registro de campeones usados por serie
  (impacta el modelo de datos).

---

## 4. Liga Principal (formato insignia, estilo LCK)

### 4.1 Temporada Regular
- Formato: **Round Robin** (todos contra todos), una o dos vueltas.
- Series: **Bo3**.
- Draft: estándar.
- Objetivo: ranking para clasificar a Playoffs.

### 4.2 Playoffs
- Formato: **Eliminación doble** (bracket superior + inferior) o escalera
  estilo LCK (definir al configurar la temporada).
- Series: **Bo5** (la final), **Bo3** rondas previas.
- Draft: **Fearless Draft**.
- Clasifican los mejores N de la temporada regular.

### 4.3 Ascenso / Descenso
- Los últimos lugares de la Liga Principal juegan contra los mejores de divisiones
  inferiores / relámpagos clasificatorios por su lugar.
- Da continuidad entre temporadas y mantiene vivo el ecosistema.

### 4.4 Sistema de puntos (temporada regular)
Propuesta base (ajustable al configurar):

| Resultado | Puntos |
|-----------|--------|
| Victoria de serie | 3 |
| Derrota de serie | 0 |

Desempates, en orden:
1. Resultado head-to-head entre empatados.
2. Diferencia de partidas (games ganados − perdidos).
3. Partida de desempate (tiebreaker) si procede.

---

## 5. Torneo Relámpago (embudo de captación)

- Formato: **Eliminación simple** (single elimination).
- Series: **Bo1** (rondas tempranas), **Bo3** (semis y final, opcional).
- Draft: estándar.
- Duración: 1 día o un fin de semana.
- Tamaño: 16 o 32 equipos.
- Inscripción: gratuita o simbólica (en fase piloto).
- **Función doble:**
  1. Captar equipos nuevos y probar el sistema en vivo.
  2. Otorgar **puntos clasificatorios** hacia la Liga Principal (circuito de puntos).

---

## 6. Circuitos Especializados

### 6.1 Femenil
- Mismos bloques que la Liga Principal, comunidad y elegibilidad dedicadas.
- Alto valor para patrocinadores que apoyan diversidad.
- Requiere política de elegibilidad clara y respetuosa (documentar en reglas).

### 6.2 Universitario
- Elegibilidad por institución (verificación de pertenencia).
- Rivalidades por escuela como gancho narrativo.
- Atractivo para patrocinadores del sector educativo/tecnológico.

### 6.3 Por Rangos / Niveles
- Segmentación por elo (ej. Hierro–Oro, Platino–Diamante) para partidas parejas.
- Reduce el abandono por desnivel; mejora la experiencia del novato.

---

## 7. Circuito de Puntos (liga unificada)

Los torneos no viven aislados: alimentan un **ranking de temporada**.

- Los relámpagos otorgan puntos clasificatorios.
- La acumulación da acceso / seeding en la Liga Principal.
- Crea una razón para volver semana a semana (progresión visible).

Esto se modela como un **circuito** que agrega resultados de varios torneos.

---

## 8. Reglas generales (base, se detallan en reglamento oficial)

- **Elegibilidad:** cuenta en buen estado, región correcta, requisitos de elo/
  institución según el torneo.
- **Rosters:** tamaño mínimo/máximo, suplentes, ventana de cambios.
- **Smurfing:** prohibido; verificación de identidad de cuenta (manual al inicio,
  automatizada después — ver `07-automatizacion-ia.md`).
- **No-shows / retrasos:** ventana de tolerancia; **forfeit automático** pasado el
  tiempo límite.
- **Conducta:** código de conducta, sanciones, proceso de disputas.
- **Pausas y remakes:** condiciones y límites.
- **Reporte de resultados:** manual con captura (piloto) → webhook de Riot (Fase 2).

---

## 9. Lo mínimo para el piloto (Fase 1)

Para el primer relámpago NO se necesita casi nada de lo anterior. Solo:

- Formato: eliminación simple, Bo1.
- Reglas básicas: elegibilidad, no-shows, conducta, reporte manual.
- Un reglamento de 1–2 páginas, claro y con la marca.

Todo lo demás (Fearless, ascenso/descenso, circuito de puntos, playoffs Bo5) es
para cuando la liga esté en marcha. Aquí queda documentado como visión.

---

## 10. Parámetros configurables (resumen para el modelo de datos)

Cada torneo debe poder definir:

- Tipo de torneo y elegibilidad.
- Fases y su formato (round robin, grupos, single/double elim, suizo).
- Formato de serie por fase (Bo1/Bo3/Bo5).
- Modo de draft por fase (estándar / Fearless).
- Sistema de puntos y reglas de desempate.
- Número de clasificados y reglas de avance.
- Pertenencia a un circuito de puntos (sí/no).

> Esta lista es el contrato que `03-modelo-datos.md` debe satisfacer.
