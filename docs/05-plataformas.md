# Plataformas y Superficies de Usuario — League App

> Documento vivo. Define QUÉ interfaces existen, para QUIÉN, y CUÁNDO se
> construyen. Decisión central: **web responsive + PWA + bot de Discord** cubren
> el "mobile" real al inicio; la app nativa es visión futura, no arranque.

---

## 1. Las superficies del producto

| Superficie | Usuario | Rol |
|------------|---------|-----|
| **Sitio público (web)** | Audiencia, fans, patrocinadores | Vitrina: liga, equipos, resultados, narrativa |
| **Dashboard de admin (web)** | Operadores de la liga | Crear/gestionar torneos, equipos, resultados |
| **Portal del jugador/capitán (web+PWA)** | Jugadores, capitanes | Inscribirse, ver calendario, check-in, perfil |
| **Bot de Discord** | Jugadores, capitanes | Avisos, check-in, códigos de partida, resultados |
| **Overlays (OBS)** | Producción / casters | Gráficos en vivo: picks&bans, lower-thirds, marcador |
| **App móvil nativa** | Jugadores, fans | (Futuro) experiencia móvil dedicada |

---

## 2. Por qué web + PWA + Discord antes que app nativa

Lo que un jugador necesita en el teléfono —inscribirse, ver su calendario, recibir
avisos, ver resultados, consultar su perfil— se resuelve con:

- **Web responsive + PWA**: instalable, con notificaciones push, offline básico,
  sin pasar por las tiendas de Apple/Google.
- **Bot de Discord**: la comunidad de LoL ya vive en Discord. El bot entrega el 80%
  de la interacción diaria (recordatorios, check-in, códigos) directamente donde el
  jugador ya está.

La **app nativa** implica dos builds, dos stores, procesos de review y más costo de
mantenimiento. Es un negocio aparte que se justifica solo cuando la liga tiene
volumen y una razón clara (ej. experiencia de espectador premium). Queda en la
visión, documentada abajo, no en el arranque.

---

## 3. Sitio público (web)

**Objetivo:** vitrina que enamora y da prestigio (efecto LCK).

Secciones:
- Home con la temporada activa, próximos partidos, destacados.
- Torneos (liga, relámpago, femenil, universitario) con sus tablas.
- Equipos: perfil, roster, historial, logo.
- Jugadores: perfil con **pro-stats** (radar: agresividad, visión, farm, KP),
  campeones más jugados, head-to-head.
- Resultados y standings en vivo.
- Narrativa: crónicas y notas de prensa generadas por IA.
- Media: clips, galería de piezas estilo LCK.
- Patrocinadores y media kit.
- Legal: reglamento, código de conducta, privacidad, disclaimer de Riot.

Técnico: Next.js con SSR/ISR para SEO y velocidad. Consume la API.

---

## 4. Dashboard de admin (web)

**Objetivo:** operar toda la liga con el mínimo esfuerzo.

Capacidades:
- **Crear torneo con TODOS los parámetros configurables** (el formulario clave):
  tipo, elegibilidad, fases y su formato, Bo1/Bo3/Bo5 por fase, draft estándar o
  Fearless, sistema de puntos, desempates, clasificados, pertenencia a circuito.
- Gestión de inscripciones (aprobar/rechazar, seeding).
- Gestión de equipos, jugadores, rosters.
- Calendario y generación de fixtures.
- Registro/corrección de resultados (con AuditLog).
- Gestión de circuitos y rankings de temporada.
- Gestión de patrocinadores y secciones patrocinadas.
- Monitor de automatización (jobs, webhooks, estado).

Acceso por **rol y organización** (owner/admin/operator/caster).

---

## 5. Portal del jugador / capitán (web + PWA)

**Objetivo:** que el jugador se sienta parte de algo serio y no dependa del admin.

Capacidades:
- Registro y verificación de cuenta Riot (RSO, Fase 3).
- Crear/unirse a equipo, gestionar roster (capitán).
- Inscribir equipo a torneos; pagar inscripción (cuando aplique).
- Ver calendario personal y próximos partidos.
- **Check-in** antes de la partida.
- Recibir el código de torneo de su partida.
- Ver su perfil y estadísticas (gamificación).
- Notificaciones push (PWA).

---

## 6. Bot de Discord

**Objetivo:** llevar la operación a donde la comunidad ya vive.

Capacidades:
- Check-in de equipos antes de la partida.
- Creación de canales de voz temporales por equipo/serie.
- Entrega del código de torneo por privado al capitán.
- Recordatorios automáticos (X minutos antes).
- **Forfeit automático** si un equipo no hace check-in a tiempo.
- Publicación de resultados y gráficos al cerrar la partida.
- Comandos de consulta (próximo partido, tabla, perfil).

Técnico: discord.js, hablando con la API; los avisos salen de `apps/worker`.

---

## 7. Overlays para transmisión (OBS)

**Objetivo:** producción con datos en vivo, estilo LCK, sin escribir nada a mano.

Overlays:
- **Picks & Bans** de la fase de draft (con soporte visual de Fearless: campeones
  ya usados en la serie).
- **Lower-thirds** (cintillos) con stat histórica del jugador al mencionarlo.
- **Marcador** de serie y de partida en vivo.
- **Pantallas** de inicio, intermedio, MVP, resultado final.

Técnico: páginas web (fuentes de navegador en OBS) que consumen datos en tiempo
real por WebSocket desde `apps/api`/`apps/worker`. Usan el design system para
consistencia visual.

---

## 8. App móvil nativa (visión futura)

Documentada para completar la visión; NO se construye al inicio.

- **Cuándo se justifica:** la liga tiene audiencia y volumen sostenido, y hay una
  experiencia que la PWA no cubre bien (ej. espectador en vivo con notificaciones
  ricas, segunda pantalla durante transmisiones).
- **Enfoque probable:** React Native / Expo para reutilizar lógica y tipos del
  monorepo (`packages/types`, `packages/core`).
- **Alcance mínimo:** seguimiento de equipos favoritos, notificaciones de partido,
  resultados y perfiles. No duplicar el dashboard de admin.

---

## 9. Mapa de construcción por fase (sin recortar visión)

| Superficie | Fase de construcción |
|------------|----------------------|
| Dashboard admin (crear torneos, resultados) | Primero — operar la liga |
| Sitio público (resultados, standings, equipos) | Primero — vitrina |
| Portal jugador/capitán + PWA | Temprano — reducir dependencia del admin |
| Bot de Discord | Tras validar operación manual (dolores reales) |
| Overlays + perfiles con pro-stats | Efecto LCK (con datos reales del piloto) |
| App móvil nativa | Futuro — solo con volumen que lo justifique |
